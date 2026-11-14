/**
 * CI-only generated candidate: four Imagine Comercial service buttons lead
 * to the NEW individual-account Portal customer preview.
 *
 * Does not touch the released website, create a service, deploy, send data,
 * or connect to the private preview. Output is an unserved temporary copy.
 */
import assert from "node:assert/strict";
import {
  cpSync, existsSync, lstatSync, mkdirSync, readFileSync,
  readdirSync, realpathSync, writeFileSync
} from "node:fs";
import { resolve, sep } from "node:path";

assert.equal(process.env.GITHUB_ACTIONS, "true", "Only isolated GitHub CI allowed");
assert.equal(process.env.IMAGINE_PORTAL_CUSTOMER_PREVIEW, "1", "Explicit opt-in required");
assert.equal(process.argv.length, 4, "Input dist and separate output required");
const input = realpathSync(process.argv[2]);
const output = resolve(process.argv[3]);
assert.ok(!existsSync(output), "Refuse overwrite");
assert.ok(output !== input && !output.startsWith(input + sep), "Output must be separate");

let bytes = 0;
let files = 0;
function validateTree(p) {
  const st = lstatSync(p);
  assert.ok(!st.isSymbolicLink(), "No source symlinks");
  if (st.isDirectory()) {
    for (const name of readdirSync(p)) {
      assert.ok(!name.startsWith("."), "No private or hidden source files");
      validateTree(resolve(p, name));
    }
  } else {
    assert.ok(st.isFile(), "Only regular files");
    ++files;
    bytes += st.size;
    assert.ok(files < 500 && bytes < 50 * 1024 * 1024 && st.size < 5 * 1024 * 1024);
  }
}
validateTree(input);

const source = readFileSync(resolve(input, "index.html"), "utf8");
const cases = Object.freeze({
  onepage: "onepage",
  "landing-pages": "landing-pages",
  "gestao-google-ads": "performance",
  "gestao-meta-ads": "performance"
});
const portal = "https://portal-dev.imaginecomunica.com.br/_preview/portal/shop?product=";
let modified = source;
for (const [slug, offer] of Object.entries(cases)) {
  let cards = 0;
  let actions = 0;
  const rx = new RegExp(
    '<article\\b[^>]*data-quick-hire="' + slug + '"[^>]*>[\\s\\S]*?</article>', "g"
  );
  modified = modified.replace(rx, card => {
    ++cards;
    return card.replace(/<a\b([^>]*data-quick-hire-action[^>]*)>/g, (_, attrs) => {
      ++actions;
      assert.ok(/\bhref="[^"]*"/.test(attrs), "Approved CTA href required");
      attrs = attrs.replace(/\bhref="[^"]*"/, 'href="' + portal + offer + '"');
      attrs = attrs.replace(/\s+target="[^"]*"/g, "");
      attrs = attrs.replace(/\s+rel="[^"]*"/g, "");
      attrs += ' rel="noreferrer nofollow"';
      return "<a" + attrs + ">";
    });
  });
  assert.equal(cards, 1, "One approved commercial card: " + slug);
  assert.equal(actions, 1, "One approved card CTA: " + slug);
}

const hero = /<section\b[^>]*class="[^"]*hero-main[^"]*"[^>]*>[\s\S]*?<\/section>/;
assert.ok(source.match(hero), "Approved original hero required");
assert.equal(modified.match(hero)?.[0], source.match(hero)?.[0], "Hero must be identical");
assert.notEqual(modified, source);

assert.ok(/<body\b[^>]*>/.test(modified), "HTML body required");
modified = modified.replace(/<body\b[^>]*>/, body =>
  body + '<aside role="status" aria-label="Homologação privada" style="padding:10px 18px;background:#fff1dd;color:#5b3200;text-align:center;font:600 13px/1.5 system-ui">Prévia de contratação com conta de teste · Ambiente privado · Sem cadastro público, pagamento ou contrato real.</aside>'
);
mkdirSync(output, { recursive: false });
cpSync(input, output, { recursive: true, errorOnExist: true });
writeFileSync(resolve(output, "index.html"), modified);

const after = readFileSync(resolve(output, "index.html"), "utf8");
for (const [slug, offer] of Object.entries(cases)) {
  const rx = new RegExp(
    '<article\\b[^>]*data-quick-hire="' + slug + '"[^>]*>[\\s\\S]*?</article>'
  );
  const card = after.match(rx)?.[0];
  assert.ok(card && card.includes('href="' + portal + offer + '"'), "Handoff link missing");
  assert.equal((card.match(/data-quick-hire-action/g) ?? []).length, 1);
}
assert.equal(readFileSync(resolve(input, "index.html"), "utf8"), source);
const manifest = {
  candidate: "Comercial-to-individual-Portal-private-preview",
  buttons: Object.keys(cases).length,
  restrictedPortalOrigin: "https://portal-dev.imaginecomunica.com.br",
  publicReleaseAuthorized: false,
  paymentEnabled: false,
  customerAccountsReal: false,
  unservedCopyOnly: true
};
writeFileSync(resolve(output, "private-portal-handoff.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("PASS four approved commercial CTAs mapped to the private Portal customer signup; source build unchanged; NO DEPLOY");
