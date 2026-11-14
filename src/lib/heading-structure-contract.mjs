/**
 * F146 — semantic heading baseline for all publicly indexable Astro pages.
 * A human-visible unique H1 must be the first real heading; headings must
 * contain meaningful text, not only an icon or an empty element.
 * Does not fetch Google, infer rankings or rewrite editorial content.
 */
import assert from 'node:assert/strict';

const matchHeading=html=>[...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
  .map(m=>({level:Number(m[1]),text:m[2].replace(/<[^>]+>/g,'')
    .replaceAll('&amp;','&').replace(/\s+/g,' ').trim()}));
export function auditPublicHeadingStructure(html){
  assert.equal(typeof html,'string','F146: compiled page required');
  const matches=matchHeading(html);
  const h1=matches.filter(x=>x.level===1);
  assert.equal(h1.length,1,'F146: exactly one H1 required');
  assert.equal(matches[0]?.level,1,'F146: first heading must be H1');
  assert.ok(h1[0].text.length>=12&&h1[0].text.length<=180,
    'F146: H1 must be descriptive');
  assert.ok(matches.some(x=>x.level===2),
    'F146: at least one thematic H2 required');
  let last=1;
  for(const heading of matches){
    assert.ok(heading.text.length>1&&heading.text.length<=220,
      'F146: empty or excessive heading');
    assert.ok(heading.level<=last+1,
      'F146: heading hierarchy jumps a semantic level');
    last=heading.level;
  }
  return Object.freeze({headingsChecked:matches.length,
    h1Count:1,networkPerformed:false});
}
