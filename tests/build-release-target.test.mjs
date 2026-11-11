import test from 'node:test';
import assert from 'node:assert/strict';
import {assertBuildReleaseIntent} from '../src/lib/build-release-target.mjs';
import {loadBuildServices} from '../src/lib/build-catalog.mjs';
import {services} from '../src/data/services.mjs';

test('F37 — ordinary editorial development uses review without deployment authority',()=>{
  const intent=assertBuildReleaseIntent({});
  assert.deepEqual(intent,{
    target:'review',signedRequired:false,
    mode:'BUILD_INTENT_ONLY_NOT_DEPLOY_AUTHORIZATION'
  });
  assert.ok(Object.isFrozen(intent));
  assert.equal(loadBuildServices({IMAGINE_RELEASE_TARGET:'review'}),services);
  assert.equal(loadBuildServices({IMAGINE_RELEASE_TARGET:''}),services);
});

test('F37 — staging and production must not build with missing signing intent',()=>{
  for(const target of ['staging','production']){
    assert.throws(()=>loadBuildServices({IMAGINE_RELEASE_TARGET:target}),
      /protected release target requires signed catalog mode/);
    assert.throws(()=>loadBuildServices({
      IMAGINE_RELEASE_TARGET:target,IMAGINE_CATALOG_REQUIRE_SIGNED:'0'
    }),/protected release target requires signed catalog mode/);
    assert.throws(()=>loadBuildServices({
      IMAGINE_RELEASE_TARGET:target,IMAGINE_CATALOG_REQUIRE_SIGNED:''
    }),/protected release target requires signed catalog mode/);
    assert.throws(()=>loadBuildServices({
      IMAGINE_RELEASE_TARGET:target,IMAGINE_CATALOG_REQUIRE_SIGNED:'1'
    }),/signed catalog required; refusing curated fallback/);
  }
});

test('F37 — production cannot bypass complete release pinning with partial config',()=>{
  assert.throws(()=>loadBuildServices({
    IMAGINE_RELEASE_TARGET:'production',
    IMAGINE_CATALOG_REQUIRE_SIGNED:'1',
    IMAGINE_CATALOG_ENVELOPE_FILE:'/tmp/untrusted.json'
  }),/required together/);
});

test('F37 — reject ambiguity, booleans, whitespace and fake production values',()=>{
  for(const value of ['prod','STAGING','Production','production ',' staging',
    'preview','local','dev',false,true,0,1,{},[],null]){
    assert.throws(()=>assertBuildReleaseIntent({IMAGINE_RELEASE_TARGET:value}),
      /invalid release target/,String(value));
  }
  for(const value of ['true','yes','on',2,true,false,'1 ',' 0']){
    assert.throws(()=>assertBuildReleaseIntent({
      IMAGINE_RELEASE_TARGET:'production',IMAGINE_CATALOG_REQUIRE_SIGNED:value
    }),/invalid signed-required mode/);
  }
});

test('F37 — target classification alone is never an attestation of delivery',()=>{
  for(const target of ['staging','production']){
    const intent=assertBuildReleaseIntent({
      IMAGINE_RELEASE_TARGET:target,IMAGINE_CATALOG_REQUIRE_SIGNED:'1'
    });
    assert.equal(intent.target,target);
    assert.equal(intent.signedRequired,true);
    assert.match(intent.mode,/NOT_DEPLOY_AUTHORIZATION/);
  }
});
