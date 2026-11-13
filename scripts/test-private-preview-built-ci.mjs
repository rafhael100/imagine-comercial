/**
 * F154 — verify compiled Astro output over authenticated HTTP loopback.
 * Only synthetic credentials, no external network, no staging or deploy.
 * Run after npm run build. No user data, tokens or paths are logged.
 */
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {sitePages} from '../src/data/services.mjs';
import {createPrivateLoopbackPreview,listenPrivateLoopback} from '../src/lib/private-loopback-preview.mjs';

const secret='F154-ephemeral-CI-test-only-password-831';
const authorization='Basic '+Buffer.from('reviewer:'+secret).toString('base64');
const server=createPrivateLoopbackPreview({directory:'dist',password:secret});
try {
  const origin=await listenPrivateLoopback(server,0);
  for(const {path} of sitePages){
    const blocked=await fetch(origin+path);
    assert.equal(blocked.status,401,'F154 unauthenticated route must be denied');
    const page=await fetch(origin+path,{headers:{Authorization:authorization}});
    assert.equal(page.status,200,'F154 authorized site route must be served');
    assert.match(page.headers.get('content-type')||'',/text\/html/i);
    assert.equal(page.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
    assert.equal(page.headers.get('cache-control'),'private, no-store, max-age=0');
    assert.match(await page.text(),/<html lang="pt-BR"/);
  }
  const assets=await readdir('dist/_astro');
  const browserAssets=assets.filter(name=>/\.(?:js|css)$/.test(name));
  assert.ok(browserAssets.length>=1,'F154 must serve at least one compiled Astro browser asset');
  for(const name of browserAssets){
    const request=await fetch(origin+'/_astro/'+name,{headers:{Authorization:authorization}});
    assert.equal(request.status,200,'F154 hashed browser asset must remain accessible');
    assert.equal(request.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
    await request.arrayBuffer();
  }
  const robots=await fetch(origin+'/robots.txt',{headers:{Authorization:authorization}});
  assert.equal(await robots.text(),'User-agent: *\nDisallow: /\n');
  const sitemap=await fetch(origin+'/sitemap.xml',{headers:{Authorization:authorization}});
  assert.equal(sitemap.status,404,'F154 must not expose indexable sitemap');
  console.log('F154 private local HTTP preview passed: '+sitePages.length+
    ' public routes and '+browserAssets.length+' compiled assets; auth/noindex/no-store; zero deploys.');
}finally{
  if(server.listening)await new Promise(resolve=>server.close(resolve));
}
