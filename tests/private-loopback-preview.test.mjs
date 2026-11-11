import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {createPrivateLoopbackPreview,listenPrivateLoopback} from '../src/lib/private-loopback-preview.mjs';

const password='synthetic-local-test-7x8c9z4b5n6p';
const basic='Basic '+Buffer.from('reviewer:'+password).toString('base64');
const auth={Authorization:basic};

test('F154: only strong operator-owned password and local listener are accepted',async()=>{
  for(const pass of [undefined,null,'',false,'short','a'.repeat(129),'abcd '.repeat(8),'é'.repeat(30)])
    assert.throws(()=>createPrivateLoopbackPreview({directory:'dist',password:pass}),
      /root and strong ASCII password required/);
  const server=createPrivateLoopbackPreview({directory:'dist',password});
  for(const port of [-1,65536,'4808',NaN]) {
    assert.throws(()=>listenPrivateLoopback(server,port),/invalid loopback listener/);
  }
  await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
});

test('F154: real HTTP review is authenticated, read-only, noindex, cacheless and local-only',async()=>{
  const root=await mkdtemp(join(tmpdir(),'imagine-private-preview-test-'));
  const outside=await mkdtemp(join(tmpdir(),'imagine-private-secret-'));
  let server;
  try {
    await mkdir(join(root,'contato'),{recursive:true});
    await mkdir(join(root,'_astro'),{recursive:true});
    await writeFile(join(root,'index.html'),'<html lang="pt-BR"><h1>Imagine</h1></html>');
    await writeFile(join(root,'contato','index.html'),'<html><h1>Contato</h1></html>');
    await writeFile(join(root,'_astro','client.abc123.css'),'body{color:black}');
    await writeFile(join(root,'secret.json'),'{"token":"TEST_SECRET_NOT_PUBLIC"}');
    await writeFile(join(outside,'external.html'),'OUTSIDE_SECRET_461');
    server=createPrivateLoopbackPreview({directory:root,password});
    const origin=await listenPrivateLoopback(server,0);
    assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(server.address().address,'127.0.0.1');
    const get=(path,options={})=>fetch(origin+path,{redirect:'manual',...options});
    const unauth=await get('/');
    assert.equal(unauth.status,401);
    assert.match(unauth.headers.get('www-authenticate'),/Basic realm=/);
    assert.equal(unauth.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
    assert.equal(unauth.headers.get('cache-control'),'private, no-store, max-age=0');
    assert.equal(unauth.headers.get('referrer-policy'),'no-referrer');
    assert.equal(unauth.headers.get('cross-origin-resource-policy'),'same-origin');
    assert.equal(unauth.headers.has('set-cookie'),false);
    assert.equal((await get('/',{headers:{Authorization:'Basic not-valid'}})).status,401);
    assert.equal((await get('/',{headers:{Authorization:'Bearer xyz'}})).status,401);
    assert.equal((await get('/',{headers:{Authorization:'Basic '+Buffer.from('reviewer:incorrect').toString('base64')}})).status,401);
    const home=await get('/',{headers:auth});
    assert.equal(home.status,200);
    assert.match(await home.text(),/Imagine/);
    assert.equal(home.headers.get('content-type'),'text/html; charset=utf-8');
    assert.equal(home.headers.get('x-frame-options'),'DENY');
    assert.match(home.headers.get('content-security-policy'),/connect-src 'none'/);
    const head=await get('/contato/',{method:'HEAD',headers:auth});
    assert.equal(head.status,200);
    assert.equal(await head.text(),'');
    const contact=await get('/contato/',{headers:auth});
    assert.equal(contact.status,200);
    assert.match(await contact.text(),/Contato/);
    const css=await get('/_astro/client.abc123.css',{headers:auth});
    assert.equal(css.status,200);
    assert.equal(css.headers.get('content-type'),'text/css; charset=utf-8');
    assert.equal(await css.text(),'body{color:black}');
    const robots=await get('/robots.txt',{headers:auth});
    assert.equal(robots.status,200);
    assert.equal(await robots.text(),'User-agent: *\nDisallow: /\n');
    const siteMap=await get('/sitemap.xml',{headers:auth});
    assert.equal(siteMap.status,404);
    const method=await get('/',{method:'POST',headers:auth,body:'PRIVATE_SENTINEL'});
    assert.equal(method.status,405);
    assert.equal(method.headers.get('allow'),'GET, HEAD');
    for(const path of ['/secret.json','/artifacts/report.json','/_astro/secret.json',
      '/_astro/.env','/contato?token=SECRET_URL_461','/%2e%2e/secret.json',
      '/contato/%2e%2e/','/contato//','/robots.txt?foo=bar']){
      const res=await get(path,{headers:auth});
      assert.equal(res.status,404,path);
      assert.doesNotMatch(await res.text(),/TEST_SECRET_NOT_PUBLIC|SECRET_URL_461/);
    }
    const fakeHost=await new Promise((resolve,reject)=>{
      const req=request(origin+'/',{method:'GET',headers:{...auth,Host:'attacker.invalid'}},res=>{
        res.resume();
        res.on('end',()=>resolve(res.statusCode));
      });
      req.on('error',reject);
      req.end();
    });
    assert.equal(fakeHost,421,'DNS rebinding host must not be served');
    await rm(join(root,'contato','index.html'));
    await symlink(join(outside,'external.html'),join(root,'contato','index.html'));
    const escaped=await get('/contato/',{headers:auth});
    assert.equal(escaped.status,404);
    assert.doesNotMatch(await escaped.text(),/OUTSIDE_SECRET_461/);
  } finally {
    if(server?.listening)await new Promise(resolve=>server.close(resolve));
    await rm(root,{recursive:true,force:true});
    await rm(outside,{recursive:true,force:true});
  }
});
