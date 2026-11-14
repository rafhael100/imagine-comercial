import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsvStrict,reviewGscPagesCsv} from '../src/lib/gsc-inventory-review.mjs';

const example=[
  'Page,Clicks,Impressions',
  'https://imaginecomunicacao.com.br/fale-conosco.html,12,230',
  'https://www.imaginecomunicacao.com.br/o-que-fazemos/google-ads-anuncios.html,7,60',
  'https://imaginecomunicacao.com.br/clientes.html,5,40',
  'https://imaginecomunicacao.com.br/legado-nao-conhecido.html,1,2',
  'https://imaginecomunicacao.com.br/servicos/criacao-de-sites/,0,10',
  'https://imaginecomunicacao.com.br/fale-conosco.html?token=private123,1,1'
].join('\n')+'\n';

test('F26: GSC CSV separates known candidates, HOLD, unknown and current routes',()=>{
  const review=reviewGscPagesCsv(example);
  assert.equal(review.schema,'imagine.comercial.gsc-inventory-review.v1');
  assert.equal(review.inputRows,6);
  assert.equal(review.uniqueRows,6);
  assert.equal(review.candidateRows,2);
  assert.equal(review.unknownRows,1);
  assert.equal(review.heldRows,2);
  const candidate=review.rows.find(x=>x.from==='/fale-conosco.html' &&
    x.state==='legacy_candidate_requires_approval');
  assert.equal(candidate.proposedTarget,'/contato/');
  assert.ok(review.rows.some(x=>x.state==='legacy_hold_requires_review'));
  assert.ok(review.rows.some(x=>x.state==='current_public_route_no_redirect'));
  assert.equal(review.rows.filter(x=>x.queryOrFragmentSuppressed).length,1);
  assert.doesNotMatch(JSON.stringify(review),/private123/);
  assert.ok(review.missingLocalLegacyPaths.includes('/en-us/'));
  assert.match(review.mode,/NO_REDIRECTS_APPROVED/);
});

test('F26: accepts BOM, Portuguese GSC Page header and semicolon delimiter',()=>{
  const x='\uFEFFPáginas principais;Cliques;Impressões\r\n'+
    '"https://www.imaginecomunicacao.com.br/en-us/contact-us.html";2;9\r\n'+
    '"https://imaginecomunicacao.com.br/fale-conosco.html";1;5';
  const result=reviewGscPagesCsv(x);
  assert.equal(result.uniqueRows,2);
  assert.equal(result.candidateRows,1);
  assert.equal(result.heldRows,1);
});

test('F26: escaped CSV quotes parse correctly and invalid quoting is refused',()=>{
  const rows=parseCsvStrict('Page,Notes\n"/fale-conosco.html","Editor said ""review"""\n');
  assert.equal(rows[1][1],'Editor said "review"');
  assert.throws(()=>parseCsvStrict('Page,Notes\n"/foo.html,bar\n'),/unmatched quote/);
  assert.throws(()=>parseCsvStrict('Page,Notes\n"/foo.html"bad,bar\n'),/extra text after quote/);
  assert.throws(()=>parseCsvStrict('Page,Notes\n/foo.html,bar,extra\n'),/inconsistent columns/);
});

test('F26: no URL outside authorized host, including deceptive prefix or userinfo',()=>{
  for(const url of [
    'https://imaginecomunicacao.com.br.evil.com/fale-conosco.html',
    'https://evil.example/fale-conosco.html',
    'https://alice@imaginecomunicacao.com.br/fale-conosco.html',
    'ftp://imaginecomunicacao.com.br/fale-conosco.html',
    '//evil.example/fale-conosco.html'
  ]){
    assert.throws(()=>reviewGscPagesCsv('URL\n'+url+'\n'),/foreign or unsafe host\/URL/);
  }
});

test('F26: query tokens and fragments are never written to evidence',()=>{
  const confidential='secret-customer-8472';
  const x='Page\nhttps://imaginecomunicacao.com.br/fale-conosco.html?utm_source='+confidential+'\n';
  const audit=reviewGscPagesCsv(x);
  assert.equal(audit.rows[0].state,'variant_hold_for_manual_review');
  assert.equal(audit.rows[0].proposedTarget,null);
  assert.doesNotMatch(JSON.stringify(audit),new RegExp(confidential));
});

test('F26: input with path encodings stays held instead of treating as approved',()=>{
  const result=reviewGscPagesCsv(
    'Page\nhttps://imaginecomunicacao.com.br/fale%2dconosco.html\n'
  );
  assert.equal(result.rows[0].unusualPath,true);
  assert.equal(result.rows[0].state,'variant_hold_for_manual_review');
  assert.equal(result.rows[0].proposedTarget,null);
});

test('F26: duplicate rows do not count twice but www host remains distinguishable',()=>{
  const x='Page\n/fale-conosco.html\n/fale-conosco.html\n'+
    'https://www.imaginecomunicacao.com.br/fale-conosco.html\n';
  const result=reviewGscPagesCsv(x);
  assert.equal(result.inputRows,3);
  assert.equal(result.uniqueRows,2);
  assert.ok(result.rows.some(v=>v.host.startsWith('www.')));
});

test('F26: missing, ambiguous or malformed headers fail closed',()=>{
  assert.throws(()=>reviewGscPagesCsv('Clicks\n3\n'),/Page\/URL column/);
  assert.throws(()=>reviewGscPagesCsv('Page,URL\n/a.html,/a.html\n'),/unique Page\/URL/);
  assert.throws(()=>reviewGscPagesCsv('Page\n'),/missing page rows/);
  assert.throws(()=>reviewGscPagesCsv('Page\n/a.html\nb,2\n'),/inconsistent columns/);
});

test('F26: strict bounds and unsafe text cannot produce a review',()=>{
  assert.throws(()=>parseCsvStrict('Page\n'+'a'.repeat(2*1024*1024+1)),/invalid input size/);
  assert.throws(()=>parseCsvStrict('Page\n'+'a\0b'),/NUL/);
  assert.throws(()=>reviewGscPagesCsv('Page\nhttps://imaginecomunicacao.com.br/<script>\n'),
    /HTML in URL/);
  assert.throws(()=>parseCsvStrict('a,b,c,d,e,f,g,h,i,j,k,l,m\n/anything\n'),/too many columns/);
});

test('F26: manifest has no deployment instructions, 301, or approved statuses',()=>{
  const result=reviewGscPagesCsv(example);
  assert.ok(result.rows.every(x=>!Object.hasOwn(x,'statusCode') &&
    !Object.hasOwn(x,'approved') && x.state!=='approved'));
  assert.ok(result.rows.every(x=>x.proposedTarget===null ||
    x.state==='legacy_candidate_requires_approval'));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.rows));
});

test('F26: refuses URL-normalization path traversal, including percent-encoded segments',()=>{
  for(const bad of [
    '/../clientes.html',
    'https://imaginecomunicacao.com.br/a/./clientes.html',
    'https://imaginecomunicacao.com.br/a/%2e%2e/clientes.html',
    'https://imaginecomunicacao.com.br/a/%2fsecret.html',
    'https://imaginecomunicacao.com.br/a/%5csecret.html'
  ]){
    assert.throws(()=>reviewGscPagesCsv('Page\n'+bad+'\n'),
      /traversal or encoded slash/);
  }
});
