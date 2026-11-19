/**
 * F356: actual compiled Astro + pinned independent SEO Engine.
 * Operates only on a disposable clone; never changes dist, DNS or network.
 */
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {auditStaticSite} from '../.qa/seo-engine/src/audit-static.mjs';

const origin='https://imaginecomunicacao.com.br/';
const args={siteUrl:origin,strictPublicHead:true,
 allowedLanguages:['pt-BR','en','es'],checkHreflang:true};
const temporary=await mkdtemp(join(tmpdir(),'imagine-comercial-robots-f356-'));
try{
 const sandbox=join(temporary,'dist');
 await cp('dist',sandbox,{recursive:true,force:false,errorOnExist:false});
 const original=await auditStaticSite(sandbox,args);
 assert.deepEqual(original.summary.errors,0,'Pristine generated Astro must pass the pinned SEO auditor');
 assert.deepEqual(original.summary.warnings,0,'Pristine generated Astro must have zero warnings');
 assert.ok(original.routes.includes('/servicos/'),'Real build must include commercial service index');
 const robots=join(sandbox,'robots.txt');
 const contents=await readFile(robots,'utf8');
 assert.match(contents,/Sitemap:\s*https:\/\/imaginecomunicacao\.com\.br\/sitemap\.xml/);
 // Each case starts from the pristine rules. The HTML, sitemap and canonical
 // remain unchanged, so a healthy build cannot hide a crawler-specific block.
 const cases=[
  {name:'wildcard service block',text:contents+'\nDisallow: /servicos/\n',blocked:true},
  {name:'versioned Googlebot service block',
   text:contents+'\nUser-agent: Googlebot/2.1\nDisallow: /servicos/\n',blocked:true},
  {name:'star-suffixed Googlebot service block',
   text:contents+'\nUser-agent: Googlebot*\nDisallow: /servicos/\n',blocked:true},
  {name:'specific versioned allow overrides wildcard root block',
   text:contents+'\nDisallow: /\n\nUser-agent: Googlebot/2.1\nAllow: /\n',blocked:false},
  {name:'Googlebot-Image does not select the general crawler',
   text:contents+'\nUser-agent: Googlebot-Image\nDisallow: /servicos/\n',blocked:false},
 ];
 for(const item of cases){
  await writeFile(robots,item.text);
  const result=await auditStaticSite(sandbox,args);
  assert.equal(result.summary.warnings,0,item.name+': literal rules need no manual review');
  if(item.blocked){
   const hit=result.errors.filter(e=>e.type==='robots_block_public_page');
   assert.ok(hit.some(e=>e.file==='servicos/index.html'),
    item.name+': pinned SEO gate must catch a built service blocked by robots');
   assert.ok(result.errors.every(e=>e.type==='robots_block_public_page'&&e.file.startsWith('servicos/')),
    item.name+': every error must be a robots block inside the service subtree');
   assert.ok(!hit.some(e=>e.file==='index.html'),
    item.name+': service-only block must not falsely report the homepage');
   assert.equal(result.errors.some(e=>e.type==='robots_block_all'),false,
    item.name+': service-only regression cannot masquerade as a root-wide block');
   assert.ok(result.summary.errors>0,item.name+': mutated build must be rejected');
  }else{
   assert.equal(result.summary.errors,0,item.name+': allowed general crawler must remain valid');
  }
 }
 console.log('F356 PASS: pristine Astro, 3 rejected service blocks and 2 crawler-selection controls');
}finally{
 await rm(temporary,{recursive:true,force:true});
}
