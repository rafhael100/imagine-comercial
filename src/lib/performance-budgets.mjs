/**
 * F12 — orçamento de bytes dos artefatos estáticos.
 * Complementa, mas NÃO substitui, Lighthouse, CrUX, LCP, INP e CLS de campo.
 */
import { lstat, readdir, readFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';

export const DEFAULT_BUDGETS=Object.freeze({
  maxHtmlBytes:160*1024,
  maxJsFileBytes:125*1024,
  maxTotalJsBytes:250*1024,
  maxCssFileBytes:120*1024,
  maxTotalImagesBytes:5*1024*1024,
  maxFiles:50000
});
function validBudget(value) {
  return Number.isSafeInteger(value)&&value>0;
}
export async function checkStaticBudgets(root,custom={}){
  if(typeof root!=='string'||root.length<1)throw new Error('budget: output directory required');
  const budgets={...DEFAULT_BUDGETS,...custom};
  if(Object.keys(custom).some(key=>!(key in DEFAULT_BUDGETS)) ||
     Object.values(budgets).some(value=>!validBudget(value))) {
    throw new Error('budget: invalid budget configuration');
  }
  const base=resolve(root);
  const baseInfo=await lstat(base);
  if(!baseInfo.isDirectory()||baseInfo.isSymbolicLink())throw new Error('budget: safe directory expected');

  const warnings=[];
  const metrics={htmlFiles:0,jsFiles:0,cssFiles:0,imageFiles:0,jsTotalBytes:0,inlineJsBytes:0,imageTotalBytes:0,largestHtmlBytes:0};
  let fileCount=0;
  async function visit(dir) {
    for(const file of await readdir(dir,{withFileTypes:true})){
      const full=join(dir,file.name),stat=await lstat(full),rel=relative(base,full).replaceAll('\\','/');
      if(stat.isSymbolicLink()) {warnings.push({type:'symlink_blocked',file:rel});continue;}
      if(stat.isDirectory()) {await visit(full);continue;}
      if(!stat.isFile())continue;
      if(++fileCount>budgets.maxFiles)throw new Error('budget: too many files');
      const ext=file.name.split('.').pop().toLowerCase();
      if(ext==='html'){
        metrics.htmlFiles++;
        metrics.largestHtmlBytes=Math.max(metrics.largestHtmlBytes,stat.size);
        if(stat.size>budgets.maxHtmlBytes)warnings.push({type:'html_oversize',file:rel,bytes:stat.size});
        // O Astro pode inserir JavaScript inline; bytes do HTML por si só não mostram esse custo.
        const html=await readFile(full,'utf8');
        for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
          const attributes=match[1]||'',body=match[2]||'';
          if(/\bsrc\s*=/.test(attributes) || /\btype\s*=\s*["']application\/ld\+json["']/i.test(attributes))continue;
          const bytes=Buffer.byteLength(body,'utf8');
          metrics.inlineJsBytes+=bytes;
          if(bytes>budgets.maxJsFileBytes)warnings.push({type:'inline_js_oversize',file:rel,bytes});
        }
      }
      if(ext==='js'||ext==='mjs'){
        metrics.jsFiles++;metrics.jsTotalBytes+=stat.size;
        if(stat.size>budgets.maxJsFileBytes)warnings.push({type:'js_file_oversize',file:rel,bytes:stat.size});
      }
      if(ext==='css'){
        metrics.cssFiles++;
        if(stat.size>budgets.maxCssFileBytes)warnings.push({type:'css_file_oversize',file:rel,bytes:stat.size});
      }
      if(['png','jpg','jpeg','webp','gif','avif'].includes(ext)){
        metrics.imageFiles++;metrics.imageTotalBytes+=stat.size;
      }
    }
  }
  await visit(base);
  if(metrics.htmlFiles===0)warnings.push({type:'missing_html'});
  if(metrics.jsTotalBytes+metrics.inlineJsBytes>budgets.maxTotalJsBytes)warnings.push({type:'total_js_oversize',bytes:metrics.jsTotalBytes+metrics.inlineJsBytes});
  if(metrics.imageTotalBytes>budgets.maxTotalImagesBytes)warnings.push({type:'total_images_oversize',bytes:metrics.imageTotalBytes});
  return Object.freeze({status:warnings.length?'budget_exceeded':'within_budget',
    budgets:Object.freeze(budgets),metrics:Object.freeze(metrics),warnings:Object.freeze(warnings)});
}
