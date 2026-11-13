import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {crossReviewIndexedCutover as review}
  from '../src/lib/private-index-cutover-correlation.mjs';

const url=p=>'https://www.imaginecomunicacao.com.br'+p;
const seen=(p,verdict='PASS')=>({url:url(p),verdict});
const decision=(from,plan)=>({from,plan});

test('F283 indexed HOLD requires explicit preserve-original decision',()=>{
  const sample={
    inspections:[
      seen('/o-que-fazemos/marketplace-amazon.html'),
      seen('/en-us/'),
      seen('/fale-conosco.html'),
      seen('/unknown-indexed-path.html'),
      seen('/o-que-fazemos/marketplace-amazon.html','NEUTRAL')
    ],
    decisions:[
      decision('/o-que-fazemos/marketplace-amazon.html','retain-original'),
      decision('/fale-conosco.html','review-redirect')
    ]
  };
  // Duplicate exact URL is rejected regardless of verdict.
  assert.throws(()=>review(sample),/ambiguous or duplicated inspection/);
  sample.inspections.pop();
  const r=review(sample);
  assert.equal(r.indexedHeldPaths,2);
  assert.equal(r.indexedHeldWithRetainAssertion,1);
  assert.equal(r.indexedHeldMissingRetainAssertion,1);
  assert.equal(r.indexedCandidates,1);
  assert.equal(r.indexedCandidatesWithExplicitReviewDecision,1);
  assert.equal(r.indexedCandidatesWithoutDecision,0);
  assert.equal(r.indexedPathsOutsideInventory,1);
  assert.equal(r.publicRedirectionsAuthorized,0);
  assert.equal(r.productionAuthorized,false);
  assert.ok(Object.isFrozen(r));
  assert.doesNotMatch(JSON.stringify(r),/marketplace|unknown-indexed|fale-conosco/);
});

test('F283 27/27 decisions and all indexed HOLD preserved still never allow release',()=>{
  const decisions=legacyUrls.map(x=>decision(x.from,
    x.status==='hold'?'retain-original':'review-redirect'));
  const r=review({inspections:[seen('/en-us/'),seen('/fale-conosco.html')],decisions});
  assert.equal(r.allKnownRoutesPlanned,true);
  assert.equal(r.inventoryMissingDecisions,0);
  assert.equal(r.indexedHeldMissingRetainAssertion,0);
  assert.equal(r.indexedCandidatesWithoutDecision,0);
  assert.equal(r.status,'NO_GO_LIVE_PRESERVATION_NOT_VERIFIED');
  assert.equal(r.googleOriginAndCompletenessVerified,false);
  assert.equal(r.originalLegacyHttpPreservationVerified,false);
  assert.equal(r.canDecommissionLegacySite,false);
});

test('F283 unmatchable URL variants are not treated as preserved evidence',()=>{
  const r=review({inspections:[
    {url:'http://www.imaginecomunicacao.com.br/en-us/',verdict:'PASS'},
    {url:url('/en-us/')+'?session=PRIVATE-F283',verdict:'PASS'},
    seen('/en-us/','NEUTRAL')
  ],decisions:[decision('/en-us/','retain-original')]});
  assert.equal(r.indexedHeldPaths,0);
  assert.equal(r.unresolvedProtocolOrQueryVariants,2);
  assert.equal(r.otherUnresolvedVerdicts,1);
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE-F283|en-us/);
});

test('F283 unvalidated GSC or decisions cannot spoof source authority',()=>{
  const valid=[seen('/fale-conosco.html')];
  const inputs=[
    {inspections:[{...valid[0],clicks:10}],decisions:[]},
    {inspections:[{url:'https://evil.invalid/',verdict:'PASS'}],decisions:[]},
    {inspections:valid,decisions:[decision('/en-us/','review-redirect')]},
    {inspections:valid,decisions:[decision('/fale-conosco.html','approved')]},
    {inspections:valid,decisions:[decision('/fale-conosco.html','pending'),
      decision('/fale-conosco.html','review-redirect')]}
  ];
  for(const input of inputs)assert.throws(()=>review(input));
});
