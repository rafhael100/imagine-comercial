import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPublicLinkGraph as audit} from '../src/lib/public-link-graph.mjs';

const page=(path,links)=>({
  path,html:'<html><body><main>'+links.map(link=>
    '<a href="'+link+'">Saiba mais</a>').join('')+'</main></body></html>'
});
const pages=()=>[
  page('/', ['/servicos/','/conteudos/','#conteudo']),
  page('/servicos/', ['/servicos/criacao-de-sites/']),
  page('/servicos/criacao-de-sites/', ['/contato/#criacao-de-sites']),
  page('/conteudos/', ['/conteudos/guia/']),
  page('/conteudos/guia/', ['/contato/']),
  page('/contato/', ['/'])
];
test('F145 verifies two-step public navigation from homepage to all known routes',()=>{
  const result=audit(pages());
  assert.equal(result.publicPages,6);
  assert.equal(result.reachablePages,6);
  assert.equal(result.maxClicksFromHome,3);
  assert.equal(result.networkPerformed,false);
});
test('F145 catches orphan pages even when included in the route catalog',()=>{
  const sample=pages();sample[3].html='<html><body><a href="/">Home</a></body></html>';
  assert.throws(()=>audit(sample),/orphan public pages/);
  assert.throws(()=>audit([
    ...pages(),page('/forgotten/',[]) ]),/orphan public pages/);
});
test('F145 enforces navigation distance and rejects forged graph parameters',()=>{
  assert.throws(()=>audit(pages(),{maxClicks:2}),/too many navigation steps/);
  assert.throws(()=>audit(pages(),{maxClicks:0}),/bounded graph depth/);
  assert.throws(()=>audit(pages(),{maxClicks:999}),/bounded graph depth/);
  assert.throws(()=>audit([page('/servicos/',[])],{}),/complete compiled site graph/);
  assert.throws(()=>audit([page('/servicos/',[]),page('/contato/',[])]),
    /home route required/);
});
test('F145 does not mistake external links or fragments for real route links',()=>{
  const sample=[
    page('/', ['https://example.com/servicos/','#conteudo']),
    page('/servicos/', ['/'])
  ];
  assert.throws(()=>audit(sample),/orphan public pages/);
  sample[0].html='<a href="/servicos/#ancora">Abrir seção</a>';
  assert.equal(audit(sample).reachablePages,2);
});
