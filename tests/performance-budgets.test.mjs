import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {checkStaticBudgets} from '../src/lib/performance-budgets.mjs';

async function withBuild(files,run){
  const root=await mkdtemp(join(tmpdir(),'imagine-static-budgets-'));
  try{
    for(const [path,data] of Object.entries(files)){
      const dir=join(root,path.split('/').slice(0,-1).join('/'));
      await mkdir(dir,{recursive:true});
      await writeFile(join(root,path),data);
    }
    return await run(root);
  } finally {await rm(root,{recursive:true,force:true});}
}
test('passes minimal valid html, css and JS bundles',async()=>{
  await withBuild({'index.html':'<html lang="pt-BR"></html>',
    'assets/app.js':'console.log("test");','assets/app.css':'body{}'},async root=>{
      const report=await checkStaticBudgets(root);
      assert.equal(report.status,'within_budget');
      assert.equal(report.metrics.htmlFiles,1);
      assert.equal(report.metrics.jsFiles,1);
    });
});
test('detects oversized HTML and a single oversized JS asset',async()=>{
  await withBuild({'index.html':'x'.repeat(30),'assets/main.js':'x'.repeat(40)},async root=>{
    const result=await checkStaticBudgets(root,{maxHtmlBytes:20,maxJsFileBytes:20,maxTotalJsBytes:100});
    assert.equal(result.status,'budget_exceeded');
    assert.ok(result.warnings.some(x=>x.type==='html_oversize'));
    assert.ok(result.warnings.some(x=>x.type==='js_file_oversize'));
  });
});
test('detects total JavaScript and raster image budgets',async()=>{
  await withBuild({'index.html':'<html></html>',
    'js/a.js':'x'.repeat(30),'js/b.js':'y'.repeat(30),
    'images/a.png':Buffer.alloc(21)},async root=>{
      const report=await checkStaticBudgets(root,{maxJsFileBytes:50,maxTotalJsBytes:50,maxTotalImagesBytes:20});
      assert.ok(report.warnings.some(x=>x.type==='total_js_oversize'));
      assert.ok(report.warnings.some(x=>x.type==='total_images_oversize'));
    });
});
test('rejects unapproved budget options and missing build',async()=>{
  await assert.rejects(checkStaticBudgets('missing-dist-23432'),/ENOENT/);
  await withBuild({'index.html':'a'},async root=>{
    await assert.rejects(checkStaticBudgets(root,{maxHtmlBytes:-1}),/invalid budget/);
    await assert.rejects(checkStaticBudgets(root,{ignoredFlag:1}),/invalid budget/);
  });
});
test('cannot report a bundle with zero HTML pages as ready',async()=>{
  await withBuild({'script.js':'console.log(1)'},async root=>{
    const r=await checkStaticBudgets(root);
    assert.ok(r.warnings.some(x=>x.type==='missing_html'));
  });
});
