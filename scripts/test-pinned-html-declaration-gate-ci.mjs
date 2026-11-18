/**
 * Actual compiled Astro + local JSON-LD contract + pinned independent Engine.
 * All mutations stay in a disposable copy; the generated dist is read-only.
 * The local contract requires Organization. The generic Engine requires some
 * active JSON-LD, so its missing_jsonld warning applies only after every real
 * JSON-LD opening on the selected route is consumed. CI fails on warnings.
 * These malformed HTML cases test static evidence, not a browser DOM tree.
 */
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {activeHtmlTokens} from '../src/lib/active-html-reader.mjs';
import {readStrictHtmlAttribute} from '../src/lib/html-attribute-reader.mjs';
import {verifyJsonLdPage} from '../src/lib/jsonld-output-contract.mjs';
import {auditStaticSite} from '../.qa/seo-engine/src/audit-static.mjs';

const origin='https://imaginecomunicacao.com.br/';
const route='/servicos/';
const relative='servicos/index.html';
const canonical=new URL(route,origin).href;
const args={siteUrl:origin,strictPublicHead:true,
  allowedLanguages:['pt-BR','en','es'],checkHreflang:true};
const declarations=[
  ['DOCTYPE SYSTEM',"<!DOCTYPE html SYSTEM '"],
  ['unknown HTML declaration','<!bogus '],
  ['processing instruction','<?audit ']
];
const temporary=await mkdtemp(join(tmpdir(),'imagine-comercial-html-declarations-'));
try{
  const sandbox=join(temporary,'dist');
  await cp('dist',sandbox,{recursive:true,force:false,errorOnExist:false});
  const target=join(sandbox,relative);
  const pristine=await readFile(target,'utf8');
  assert.equal(verifyJsonLdPage(pristine,canonical),true,
    'Pristine generated route must pass the local JSON-LD contract');
  const baseline=await auditStaticSite(sandbox,args);
  assert.equal(baseline.summary.errors,0,'Pristine generated Astro must pass the pinned Engine');
  assert.equal(baseline.summary.warnings,0,'Pristine generated Astro must have zero warnings');
  assert.ok(baseline.routes.includes(route),'Real build must include the selected service index');

  const scripts=activeHtmlTokens(pristine)
    .filter(token=>!token.closing&&token.name==='script'&&token.closingStart!==null)
    .filter(token=>readStrictHtmlAttribute(token.raw,'type')==='application/ld+json')
    .map(token=>({...token,value:JSON.parse(pristine.slice(token.end,token.closingStart))}));
  const organization=scripts.filter(token=>token.value?.['@type']==='Organization');
  assert.equal(organization.length,1,'Real build must have one selectable Organization SCRIPT');
  assert.ok(scripts.some(token=>token.start>organization[0].start&&token.value?.['@type']==='WebPage'),
    'Real build must retain an actual WebPage SCRIPT after Organization');

  const consumeOpenings=(selected,prefix)=>{
    let html=pristine;
    // Work backwards so each original offset remains valid. Only the opening
    // gains a prefix: its first > now ends the declaration, even after a quote.
    // Every byte after that opening, including later SCRIPT, stays unchanged.
    for(const token of [...selected].reverse())
      html=html.slice(0,token.start)+prefix+html.slice(token.start);
    return html;
  };

  const checkMutation=async(label,html,expectMissing)=>{
    assert.equal(await readFile(target,'utf8'),pristine,
      'Each mutation must start from the restored pristine route');
    try{
      await writeFile(target,html);
      const candidate=await readFile(target,'utf8');
      assert.throws(()=>verifyJsonLdPage(candidate,canonical),/expected one Organization/,
        label+': local contract must reject the absorbed Organization opening');
      const audited=await auditStaticSite(sandbox,args);
      assert.equal(audited.summary.errors,0,label+': no unrelated Engine errors are expected');
      if(expectMissing){
        assert.deepEqual(audited.warnings.map(({type,file})=>({type,file})),
          [{type:'missing_jsonld',file:relative}],
          label+': missing JSON-LD warning must be confined to the mutated route');
        assert.equal(audited.summary.warnings,1,
          label+': the workflow fail-on-warnings policy must reject this build');
      }else{
        // Organization is required locally, but WebPage and BreadcrumbList
        // still provide active JSON-LD to the generic independent auditor.
        assert.equal(audited.summary.warnings,0,
          label+': actual JSON-LD after the declaration must remain recognized');
      }
    }finally{
      await writeFile(target,pristine);
    }
  };

  for(const [name,prefix] of declarations){
    await checkMutation(name+' / Organization only',consumeOpenings(organization,prefix),false);
    await checkMutation(name+' / all JSON-LD',consumeOpenings(scripts,prefix),true);
  }
  assert.equal(await readFile(target,'utf8'),pristine,'Disposable route must be restored');
  assert.equal(await readFile(join('dist',relative),'utf8'),pristine,
    'Original compiled route must remain unchanged');
  console.log('Pinned HTML declarations PASS: pristine build approved; 3 Organization-only cases preserve later JSON-LD; 3 all-JSON-LD cases produce route-scoped missing_jsonld warnings');
}finally{
  await rm(temporary,{recursive:true,force:true});
}
