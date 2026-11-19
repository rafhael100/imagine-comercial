import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {legacyPublicSitemapProvenance,legacyPublicSitemapPaths,
 legacyPublicSitemapProtectedVariants} from '../src/data/legacy-public-sitemap-paths.mjs';
test('F314 frozen public sitemap paths have exact digest and exclude malformed loc',()=>{
 assert.equal(legacyPublicSitemapProvenance.publishedLocEntries,82);
 assert.equal(legacyPublicSitemapPaths.length,81);
 assert.equal(new Set(legacyPublicSitemapPaths).size,81);
 assert.equal(legacyPublicSitemapProtectedVariants.length,161);
 assert.equal(new Set(legacyPublicSitemapProtectedVariants).size,161);
 assert.equal(legacyPublicSitemapProvenance.sourceXmlSha256,
  '59b27501438ea05f097ebae9a2a669c047050604eacfee390c18a84dd926797f');
 assert.equal(createHash('sha256').update(legacyPublicSitemapPaths.join('\n')+'\n')
  .digest('hex'),legacyPublicSitemapProvenance.orderedPathsSha256);
 assert.ok(legacyPublicSitemapPaths.every(path=>path.startsWith('/')&&
  !path.includes('//')&&!/[?#\x00-\x20]/.test(path)));
 assert.equal(legacyPublicSitemapPaths.includes('/contato'),true);
 assert.equal(legacyPublicSitemapPaths.includes('/contato/'),false);
 assert.equal(legacyPublicSitemapProtectedVariants.includes('/contato/'),true);
 assert.equal(legacyPublicSitemapPaths.includes('/component/imaginecontato'),true);
 assert.equal(legacyPublicSitemapProvenance.redirectsApproved,0);
 assert.equal(legacyPublicSitemapProvenance.contentEquivalenceProven,false);
 assert.ok(Object.isFrozen(legacyPublicSitemapPaths));
 assert.ok(Object.isFrozen(legacyPublicSitemapProtectedVariants));
});
