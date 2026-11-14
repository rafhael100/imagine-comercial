/**
 * Fail-closed differential comparison of public and private Astro builds.
 * Deliberately does not weaken the public outbound-link checker.
 */
import assert from "node:assert/strict";
import {lstatSync,readdirSync,readFileSync} from "node:fs";
import {resolve,join,relative,sep} from "node:path";
assert.equal(process.argv.length,4,"Usage: compare-native-builds.mjs <public dist> <private dist>");
const roots=[resolve(process.argv[2]),resolve(process.argv[3])];
function inventory(root){
  const paths=[];
  function visit(path){
    const st=lstatSync(path);
    assert.ok(!st.isSymbolicLink(),"Build must not contain symlinks");
    if(st.isDirectory()){
      for(const entry of readdirSync(path)) {
        assert.ok(!entry.startsWith("."),"No hidden artifacts in generated build");
        visit(join(path,entry));
      }
    }else{
      assert.ok(st.isFile() && st.size<=5*1024*1024,"Only bounded regular files");
      paths.push(relative(root,path).split(sep).join("/"));
    }
  }
  visit(root);
  return paths.sort();
}
const [filesA,filesB]=roots.map(inventory);
assert.deepEqual(filesA,filesB,"Private mode cannot introduce or remove build files");
function normalizeHome(html){
  const four=["onepage","landing-pages","gestao-google-ads","gestao-meta-ads"];
  let out=html;
  for(const slug of four){
    const rx=new RegExp('<article\\b[^>]*data-quick-hire="'+slug+'"[^>]*>[\\s\\S]*?<\\/article>');
    const card=out.match(rx)?.[0];
    assert.ok(card,"Missing expected card: "+slug);
    const normalized=card.replace(/<a\b[^>]*data-quick-hire-action[^>]*>/,'<a data-quick-hire-action>');
    assert.notEqual(normalized,card,"CTA opening tag missing: "+slug);
    out=out.replace(card,normalized);
  }
  const notice=/<p\b[^>]*id="quick-hire-notice"[^>]*>[\s\S]*?<\/p>/;
  assert.ok(out.match(notice),"Quick-hire disclosure missing");
  return out.replace(notice,'<p id="quick-hire-notice">REVIEW_NOTICE</p>');
}
for(const file of filesA){
  const original=readFileSync(join(roots[0],file));
  const candidate=readFileSync(join(roots[1],file));
  if(file!=="index.html")assert.ok(original.equals(candidate),"Unexpected non-homepage difference: "+file);
  else{
    assert.notEqual(original.toString("utf8"),candidate.toString("utf8"),"CI-only mode must differ");
    assert.equal(normalizeHome(original.toString("utf8")),normalizeHome(candidate.toString("utf8")),
      "Private homepage changes outside four CTA tags and one notice paragraph");
  }
}
console.log("PASS byte-identical  non-homepage build and restricted homepage-only private CTA delta");
