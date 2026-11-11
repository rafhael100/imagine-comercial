/**
 * F150 — closed HTML inventory for static Astro output. Refuse accidentally
 * generated public documents not present in the reviewed route catalog.
 * This also catches unlisted HTML left behind by experimental builds.
 */
import assert from 'node:assert/strict';

const ROUTE=/^\/(?:[a-z0-9-]+\/)*$/;
const GENERATED=/^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.html$/;

export function auditGeneratedHtmlInventory(builtHtmlFiles,sitePaths){
  assert.ok(Array.isArray(builtHtmlFiles)&&Array.isArray(sitePaths)&&
    sitePaths.length>0,'F150: complete build and route inventory required');
  const expected=new Set(['404.html']);
  for(const path of sitePaths){
    assert.equal(typeof path,'string','F150: invalid public route');
    assert.match(path,ROUTE,'F150: invalid public route');
    const file=path==='/'?'index.html':path.slice(1)+'index.html';
    assert.ok(!expected.has(file),'F150: duplicated catalog route');
    expected.add(file);
  }
  const found=new Set();
  for(const path of builtHtmlFiles){
    assert.equal(typeof path,'string','F150: invalid HTML file inventory');
    assert.match(path,GENERATED,'F150: malformed HTML build path');
    assert.ok(!found.has(path),'F150: duplicate HTML output');
    found.add(path);
  }
  assert.equal(found.size,expected.size,
    'F150: unexpected or missing HTML documents in public bundle');
  for(const file of expected){
    assert.ok(found.has(file),
      'F150: the published HTML inventory differs from the reviewed catalog');
  }
  return Object.freeze({
    htmlPagesChecked:found.size,
    approvedIndexablePages:sitePaths.length,
    special404Count:1,
    networkPerformed:false
  });
}
