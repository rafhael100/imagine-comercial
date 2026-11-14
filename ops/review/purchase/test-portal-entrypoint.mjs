/**
 * P0 navigation and CTA guard, CI-only. The site must include a discoverable
 * Portal do Cliente entrypoint on desktop and mobile when the official URL
 * has been reviewed and explicitly injected at Astro build-time.
 *
 * This test never logs in, visits a public Portal, or deploys the Comercial.
 */
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {resolvePortalLoginLink} from "../../src/lib/portal-login-link.mjs";

assert.equal(process.env.GITHUB_ACTIONS,"true","CI only");
assert.equal(process.argv.length,4,"Usage: test-portal-entrypoint.mjs <static-dir> <source|private>");
const directory=resolve(process.argv[2]);
const phase=process.argv[3];
assert.ok(["source","private"].includes(phase));
const url="https://portal.imaginecomunicacao.com.br/login";
assert.equal(process.env.PUBLIC_PORTAL_LOGIN_URL,url,"Use only the reviewed, not-yet-published login URL");
assert.equal(resolvePortalLoginLink(url),url);
for(const invalid of [
  "http://portal.imaginecomunicacao.com.br/login",
  "https://portal-dev.imaginecomunica.com.br/_preview/portal",
  "https://portal.imaginecomunicacao.com.br/login?token=example",
  "https://portal.imaginecomunicacao.com.br/%2e%2e/login",
  "https://evil.example/login",
  "https://portal.imaginecomunicacao.com.br:8080/login",
  "https://user:secret@portal.imaginecomunicacao.com.br/login"
])assert.equal(resolvePortalLoginLink(invalid),"","Unsafe customer login URL must be omitted");
assert.equal(resolvePortalLoginLink(""),"","Unconfigured site must omit portal shortcut");

const htmlPath=resolve(directory,"index.html");
assert.ok(statSync(htmlPath).isFile());
const html=readFileSync(htmlPath,"utf8");
function menu(label){
  const regex=new RegExp('<nav\\b[^>]*aria-label="'+label+'"[^>]*>([\\s\\S]*?)<\\/nav>','i');
  const block=html.match(regex);
  assert.ok(block,"Missing navigation landmark: "+label);
  return block[1];
}
const desktop=menu("Navegação principal");
const mobile=menu("Navegação móvel");
for(const [label,content] of [["desktop",desktop],["mobile",mobile]]){
  const matches=[...content.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>[^<]*Portal do Cliente[^<]*<\/a>/g)];
  assert.equal(matches.length,1,label+" must present exactly one Portal do Cliente entrypoint");
  assert.equal(matches[0][1],url,label+" must use the reviewed absolute HTTPS login URL");
  assert.ok(!matches[0][0].includes("target=\"_blank\""),"Login stays in current tab");
}
assert.equal((html.match(/>Portal do Cliente<\/a>/g)||[]).length,2,"Only desktop and mobile entries allowed");
assert.ok(html.includes('class="hero hero-main"'),"Do not replace approved Astro hero");

if(phase==="private"){
  const manifest=JSON.parse(readFileSync(resolve(directory,"private-portal-handoff.json"),"utf8"));
  assert.equal(manifest.buttons,4);
  assert.equal(manifest.publicReleaseAuthorized,false);
  assert.equal(manifest.paymentEnabled,false);
  assert.equal(manifest.unservedCopyOnly,true);
  const serviceMap=new Map([
    ["onepage","onepage"],
    ["landing-pages","landing-pages"],
    ["gestao-google-ads","performance"],
    ["gestao-meta-ads","performance"]
  ]);
  for(const [slug,offer] of serviceMap){
    const card=html.match(new RegExp('<article\\b[^>]*data-quick-hire="'+slug+'"[^>]*>[\\s\\S]*?<\\/article>'))?.[0];
    assert.ok(card,"Service card missing: "+slug);
    const links=[...card.matchAll(/<a\b[^>]*data-quick-hire-action[^>]*>/g)];
    assert.equal(links.length,1,"One CTA per service: "+slug);
    assert.ok(links[0][0].includes('href="https://portal-dev.imaginecomunica.com.br/_preview/portal/shop?product='+offer+'"'),
      "Private candidate must preserve chosen service: "+slug);
  }
  assert.ok(html.includes("Ambiente privado"),"Private review must prominently state scope");
} else {
  assert.ok(!html.includes("private-portal-handoff.json"),"Original build must stay independent");
}
console.log("PASS: Portal do Cliente desktop/mobile + 4 private Comercial CTAs, no public login or deployment, "+phase);
