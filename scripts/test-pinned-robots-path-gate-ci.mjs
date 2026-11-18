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
 // A realistic migration mistake: sitemap/canonical still look healthy, but
 // robots starts to block only the service subtree, not the homepage.
 await writeFile(robots,contents+'\nDisallow: /servicos/\n');
 const blocked=await auditStaticSite(sandbox,args);
 const hit=blocked.errors.filter(e=>e.type==='robots_block_public_page');
 assert.ok(hit.some(e=>e.file==='servicos/index.html'),
  'Pinned independent SEO gate must catch a built service blocked by robots');
 assert.ok(!hit.some(e=>e.file==='index.html'),
  'Blocking a service subtree must not falsely report the homepage');
 assert.equal(blocked.errors.some(e=>e.type==='robots_block_all'),false,
  'Service-only regression cannot masquerade as a root-wide block');
 assert.ok(blocked.summary.errors>0,'Mutated build must be rejected');
 console.log('F356 PASS: pristine build audited and disposable service-blocked robots mutation rejected');
}finally{
 await rm(temporary,{recursive:true,force:true});
}
