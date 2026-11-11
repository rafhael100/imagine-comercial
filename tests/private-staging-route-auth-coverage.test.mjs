import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {reviewPrivateStagingHttp} from '../src/lib/private-staging-http-gate.mjs';

const basicAuth='Basic '+Buffer.from('reviewer:SyntheticPrivateF168StagingPassword2026').toString('base64');
const held=legacyUrls.find(x=>x.status==='hold')?.from;
assert.ok(held,'expected reviewed held legacy URL');

function anonymous401Headers(){
  return {
    'WWW-Authenticate':'Basic realm="Imagine private review"',
    'Cache-Control':'private, no-store',
    'X-Robots-Tag':'noindex, nofollow, noarchive'
  };
}
function simulation({leakedPath,leakedStatus=200,badHeader=null}={}){
  const requests=[];
  const transport=async(url,options)=>{
    const path=new URL(url).pathname,auth=options.headers?.Authorization;
    requests.push({path,authorized:!!auth,method:options.method});
    if(auth)throw Error('F168: unauthorized pass must not reach authenticated phase');
    const headers=anonymous401Headers();
    if(badHeader&&path===leakedPath)delete headers[badHeader];
    return new Response('synthetic',{status:path===leakedPath?leakedStatus:401,
      headers});
  };
  return {requests,transport};
}

test('F168 rejects any anonymous 200/404 on legacy, SEO, error or asset paths',async()=>{
  for(const path of [
    '/servicos/',held,'/robots.txt','/sitemap.xml','/perguntas-frequentes/',
    '/_astro/__imagine_private_access_probe__.js'
  ]){
    for(const status of [200,404]){
      const {transport,requests}=simulation({leakedPath:path,leakedStatus:status});
      await assert.rejects(
        reviewPrivateStagingHttp({port:4321,basicAuth,transport}),
        /private staging routes are not all protected/,
        'must reject anonymous '+status+' '+path
      );
      assert.ok(requests.length>=1);
      assert.ok(requests.every(x=>!x.authorized&&x.method==='GET'));
    }
  }
});
test('F168 fails closed if any 401 response lacks its challenge, noindex or no-store',async()=>{
  for(const field of ['WWW-Authenticate','Cache-Control','X-Robots-Tag']){
    const {transport,requests}=simulation({
      leakedPath:'/sitemap.xml',leakedStatus:401,badHeader:field
    });
    await assert.rejects(reviewPrivateStagingHttp({
      port:4321,basicAuth,transport
    }),/private staging routes are not all protected/);
    assert.ok(requests.some(x=>x.path==='/sitemap.xml'));
    assert.ok(requests.every(x=>!x.authorized));
  }
});
test('F168 unauthenticated gate has a bounded, fixed inventory and never accepts URLs',async()=>{
  const paths=[];
  const t=async(url,options)=>{
    const path=new URL(url).pathname;
    paths.push(path);
    return new Response('Protected',{status:401,headers:anonymous401Headers()});
  };
  await assert.rejects(
    reviewPrivateStagingHttp({port:4321,basicAuth,transport:t}),
    /private staging HTTP gate failed closed/
  );
  assert.equal(paths.length,27,'26 anonymous probes, then first authorized probe');
  assert.equal(new Set(paths.slice(0,26)).size,26);
  assert.equal(paths[0],'/');
  assert.ok(paths.slice(0,26).includes(held));
  assert.ok(paths.every(path=>path.startsWith('/')&&!path.includes('?')));
});
