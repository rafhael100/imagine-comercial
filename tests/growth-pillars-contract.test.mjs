import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('F330: one approved icon sequence in an accessible, static, translatable component',()=>{
 const c=source('src/components/GrowthPillars.astro');
 for(const p of ["'pt-BR'","en:","es:","['Visitas','Leads','Clientes']","['Visits','Leads','Customers']",
  "data-growth-stage=\"visits\"","data-growth-stage=\"leads\"","data-growth-stage=\"customers\"",
  'aria-hidden="true"','growth-feature','growth-signature'])
  assert.ok(c.includes(p),p);
 assert.equal((c.match(/<li class="growth-pill"/g)||[]).length,3);
 assert.equal((c.match(/<svg /g)||[]).length,3);
 assert.doesNotMatch(c,/<form\b|<input\b|<script\b|\bfetch\s*\(|\blocalStorage\b|\bdocument\.cookie\b/);
 assert.ok(c.includes('background:#edf3e9'));
 assert.ok(c.includes('color:#31572c'));
});

test('F330: home section appears once after hero; approved site cards and checkout untouched',()=>{
 const page=source('src/pages/index.astro');
 const hero=page.indexOf('<section class="hero hero-main">');
 const method=page.indexOf('<GrowthPillars variant="feature" locale="pt-BR" />');
 const services=page.indexOf('<QuickServiceRequest />');
 assert.ok(hero>=0 && hero<method && method<services);
 assert.equal((page.match(/GrowthPillars variant="feature"/g)||[]).length,1);
 const international=source('src/components/InternationalSalesHome.astro');
 assert.ok(international.includes('<GrowthPillars variant="feature" locale={locale} />'));
 assert.ok(international.indexOf('</section>\n<GrowthPillars')<
   international.indexOf('<section class="intl-shop-section" id="intl-solutions"'));
});

test('F330: quiet universal signature in PT EN ES footers, no second page hero',()=>{
 const base=source('src/layouts/BaseLayout.astro');
 const intl=source('src/layouts/InternationalLayout.astro');
 assert.equal((base.match(/GrowthPillars variant="signature"/g)||[]).length,1);
 assert.equal((intl.match(/GrowthPillars variant="signature"/g)||[]).length,1);
 assert.match(base,/GrowthPillars variant="signature" locale="pt-BR"/);
 assert.match(intl,/GrowthPillars variant="signature" locale=\{locale\}/);
 for(const s of [base,intl])assert.ok(s.indexOf('GrowthPillars variant="signature"')<s.indexOf('class="shell footer-bottom"'));
});

test('F330: methodology documentation does not conflate leads with sales or promise results',()=>{
 const docs=source('docs/METODOLOGIA-IMAGINE-VISITAS-LEADS-CLIENTES-2026-11-15.md');
 for(const label of ['Visitas → Leads → Clientes','Imagine Sites','Imagine CRM',
   'Imagine SEO Engine','Imagine Performance AI','Imagine Portal','Universidade Imagine','Imagine AI Agents'])
   assert.ok(docs.includes(label),label);
 assert.ok(docs.includes('visita ≠ pessoa única'));
 assert.ok(docs.includes('lead ≠ venda'));
 assert.ok(docs.includes('NO-DEPLOY'));
});
