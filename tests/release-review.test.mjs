import test from 'node:test';
import assert from 'node:assert/strict';
import {createReleaseReview, verifyReleaseReview} from '../src/lib/release-review.mjs';

const bytes = value => Buffer.from(value, 'utf8');
const base = () => [
  {path:'index.html', bytes:bytes('<html>home</html>')},
  {path:'404.html', bytes:bytes('<html>not found</html>')},
  {path:'robots.txt', bytes:bytes('User-agent: *\nAllow: /\n')},
  {path:'sitemap.xml', bytes:bytes('<urlset></urlset>')},
  {path:'_astro/app.css', bytes:bytes('body{margin:0}')}
];
const options = {routes:['/']};

test('F22 hashes and sorts the exact static files deterministically',()=>{
  const list = base();
  const one = createReleaseReview(list, options);
  const two = createReleaseReview([...list].reverse(), options);
  assert.deepEqual(one, two);
  assert.equal(one.mode, 'REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY');
  assert.equal(one.htmlPages, 1);
  assert.equal(one.fileCount, list.length);
  assert.match(one.treeSha256, /^[a-f0-9]{64}$/);
  assert.ok(one.files.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
  assert.equal(verifyReleaseReview(list, JSON.parse(JSON.stringify(one)), options), true);
});

test('F22 detects a changed byte, missing HTML and unapproved HTML',()=>{
  const original = base();
  const manifest = createReleaseReview(original, options);
  const tampered = base();
  tampered[0].bytes = bytes('<html>modified</html>');
  assert.throws(()=>verifyReleaseReview(tampered, manifest, options), /manifest does not match/);
  assert.throws(()=>createReleaseReview(base().filter(x=>x.path!=='index.html'),options),
    /unexpected or missing HTML/);
  assert.throws(()=>createReleaseReview([...base(),{
    path:'unreviewed/index.html',bytes:bytes('<html></html>')
  }],options), /unexpected or missing HTML/);
});

test('F22 blocks deployment directives and private source files from an artifact',()=>{
  for(const path of ['_redirects','_headers','wrangler.toml','package.json',
    '.env','src/.env','dist/../foo.js','evil//index.html',
    '../robots.txt','_astro/app.js.map']) {
    assert.throws(()=>createReleaseReview([...base(),{path,bytes:bytes('x')}],options),
      /invalid relative file path|deployment rules or source metadata|disallowed output file type/,path);
  }
});

test('F22 refuses duplicate paths and required file omissions',()=>{
  assert.throws(()=>createReleaseReview([...base(),base()[0]],options),/duplicated output file/);
  for(const required of ['404.html','robots.txt','sitemap.xml']) {
    assert.throws(()=>createReleaseReview(base().filter(x=>x.path!==required), options),
      /missing required output file/,required);
  }
});

test('F22 imposes limits on total package and individual static files',()=>{
  const overLimit = [...base(),{path:'large.png',bytes:Buffer.alloc(10*1024*1024+1)}];
  assert.throws(()=>createReleaseReview(overLimit,options),/output file too large/);
  const tooMany = [...base(),...Array.from({length:501},(_,i)=>({
    path:'_astro/'+i+'.css',bytes:bytes('x')
  }))];
  assert.throws(()=>createReleaseReview(tooMany,options),/invalid number of output files/);
});
