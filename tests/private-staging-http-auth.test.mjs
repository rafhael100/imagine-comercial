import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {localHeaderProfile} from '../src/lib/security-headers-preview.mjs';
import {reviewPrivateStagingHttp as review}
  from '../src/lib/private-staging-http-gate.mjs';

const password='Synthetic-F166-Password-Staging-Only';
const basicAuth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
const publicPaths=new Set(['/','/servicos/','/conteudos/','/contato/']);
const legacyPaths=new Set(legacyUrls.filter(x=>x.status==='hold').map(x=>x.from));
const headers=Object.fromEntries([...localHeaderProfile,['Content-Type','text/html; charset=utf-8'],['Cache-Control','private, no-store']]);
const html=path=>publicPaths.has(path)
  ?'<html><head><meta name="robots" content="index,follow">'+
   '<link rel="canonical" href="https://imaginecomunicacao.com.br'+path+'">'+
   '</head><body><h1>Imagine</h1></body></html>'
  :'<html><head><meta name="robots" content="noindex,nofollow"></head>'+
   '<body><h1>Não encontramos a página</h1></body></html>';
const transportFactory=(access='allowed')=>{
  const seen=[];
  const transport=async(url,options)=>{
    seen.push({path:new URL(url).pathname,method:options.method,
      hasAuth:options.headers?.Authorization===basicAuth});
    const path=new URL(url).pathname;
    const isAuthorized=options.headers?.Authorization===basicAuth;
    if(!isAuthorized || access==='deny-all')
      return new Response('Unauthorized',{
        status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="Imagine private review"',
          'X-Robots-Tag':'noindex, nofollow, noarchive'}
      });
    return new Response(html(path),{
      status:publicPaths.has(path)?200:404,
      headers:{...headers,'X-Robots-Tag':'noindex, nofollow, noarchive'}
    });
  };
  return {transport,seen};
};
test('F168 staging denies all 26 anonymous routes BEFORE 22 authenticated routes',async()=>{
  const fake=transportFactory();
  const report=await review({port:4321,basicAuth,transport:fake.transport});
  assert.equal(report.totalHttpChecks,22);
  assert.equal(report.reviewedPublicPages,4);
  assert.equal(report.heldLegacyPages,18);
  assert.equal(report.unauthenticatedEntryDenied,true);
  assert.equal(report.unauthenticatedRoutesDenied,26);
  assert.equal(report.deploymentAuthorized,false);
  assert.equal(fake.seen.length,48);
  assert.deepEqual(fake.seen[0],{path:'/',method:'GET',hasAuth:false});
  assert.ok(fake.seen.slice(0,26).every(x=>!x.hasAuth&&x.method==='GET'));
  assert.ok(fake.seen.slice(26).every(x=>x.hasAuth&&x.method==='GET'&&
    (publicPaths.has(x.path)||legacyPaths.has(x.path))));
  assert.equal(new Set(fake.seen.slice(0,26).map(x=>x.path)).size,26);
  for(const path of ['/robots.txt','/sitemap.xml','/404.html',
    '/_astro/__imagine_private_access_probe__.js'])
    assert.ok(fake.seen.slice(0,26).some(x=>x.path===path));
  assert.equal(JSON.stringify(report).includes(password),false);
  assert.ok(Object.isFrozen(report));
});
test('F166 public staging or broken login must fail closed',async()=>{
  const opened=async(url,options)=>{
    return new Response(html(new URL(url).pathname),{
      status:200,headers:{...headers}
    });
  };
  await assert.rejects(review({port:4321,basicAuth,transport:opened}),
    /routes are not all protected/);
  await assert.rejects(review({
    port:4321,basicAuth,transport:transportFactory('deny-all').transport
  }),/private staging HTTP gate failed closed/);
});
test('F166 malformed, weak or injected Basic headers cannot reach the network',async()=>{
  let requests=0;
  const noNetwork=async()=>{requests++;throw Error('MUST_NOT_EXECUTE');};
  for(const header of ['',null,123,'Bearer value','Basic bad tokens',
    'Basic '+Buffer.from('not-reviewer:password').toString('base64'),
    'Basic '+Buffer.from('reviewer:short').toString('base64'),
    basicAuth+'\r\nX-Extra: leaked']){
    await assert.rejects(review({port:4321,basicAuth:header,transport:noNetwork}),
      /F166: invalid private staging/);
  }
  assert.equal(requests,0);
});
