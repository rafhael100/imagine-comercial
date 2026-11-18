import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { services } from '../src/data/services.mjs';
import { commercialFaqSections } from '../src/data/commercial-faq.mjs';
import { processStages } from '../src/data/commercial-process.mjs';
import { getActionCatalog } from '../ops/faisca/core.mjs';
import { CATALOG_JSON, CATALOG_SHA256 } from '../ops/faisca/grounding/catalog.mjs';
import { hasConflictingGroundingFacts } from '../ops/faisca/grounding/guide.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePaths = ['src/data/services.mjs', 'src/data/commercial-faq.mjs', 'src/data/commercial-process.mjs'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const text = (value, max) => typeof value === 'string' && value.length > 0 &&
  Buffer.byteLength(value, 'utf8') <= max && !/[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u.test(value);
const keys = (value, expected) => assert.deepEqual(Object.keys(value ?? {}).sort(), [...expected].sort(), 'Unexpected catalog fields.');

/** Closed data selectors only. No eval, property path execution or dynamic import. */
function extract(sourcePath, selector) {
  if (sourcePath === sourcePaths[0]) {
    const match = /^services\[slug=([a-z0-9-]+)\]\.(description|intro|approach|faqs\[([01])\]\[1\]|details\[([012])\]\[1\])$/.exec(selector);
    assert.ok(match, 'Unknown service selector.');
    const service = services.find(item => item.slug === match[1]);
    assert.ok(service, 'Unknown service.');
    return match[3] !== undefined ? service.faqs[Number(match[3])][1]
      : match[4] !== undefined ? service.details[Number(match[4])][1] : service[match[2]];
  }
  if (sourcePath === sourcePaths[1]) {
    const match = /^commercialFaqSections\.questions\[id=([a-z]+)\]\.answer$/.exec(selector);
    assert.ok(match, 'Unknown FAQ selector.');
    return commercialFaqSections.flatMap(section => section.questions).find(question => question.id === match[1])?.answer;
  }
  if (sourcePath === sourcePaths[2]) {
    const match = /^processStages\[key=([a-z]+)\]\.summary$/.exec(selector);
    assert.ok(match, 'Unknown process selector.');
    return processStages.find(stage => stage.key === match[1])?.summary;
  }
  assert.fail('Unreviewed source path.');
}

/** Trusted host overrides permit isolated negative fixtures, never HTTP input. */
export async function verifyGroundingCatalog({ sourceRoot = repositoryRoot, catalogBytes,
  expectedJson = CATALOG_JSON, expectedDigest = CATALOG_SHA256 } = {}) {
  const bytes = catalogBytes ?? await readFile(resolve(sourceRoot, 'ops/faisca/grounding/catalog.json'));
  assert.ok(bytes instanceof Uint8Array && bytes.length <= 32768, 'Catalog byte limit.');
  const serialized = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  assert.equal(serialized, expectedJson, 'Generated catalog module differs from JSON bytes.');
  assert.equal(digest(bytes), expectedDigest, 'Catalog digest differs from its reviewed pin.');
  const catalog = JSON.parse(serialized);
  assert.equal(JSON.stringify(catalog, null, 2) + '\n', serialized, 'Catalog JSON must have canonical pretty formatting.');
  keys(catalog, ['schema', 'version', 'scope', 'sourceSnapshot', 'passages', 'answers']);
  assert.equal(catalog.schema, 'faisca.grounding.catalog.v1');
  assert.equal(catalog.version, 'faisca-grounding-1');
  assert.equal(catalog.scope, 'public_comercial');
  keys(catalog.sourceSnapshot, ['repository', 'commit', 'files']);
  assert.equal(catalog.sourceSnapshot.repository, 'rafhael100/imagine-comercial');
  assert.equal(catalog.sourceSnapshot.commit, '84b4c82d1a7ff77b4ee7212bc877d4639ceb809d');
  keys(catalog.sourceSnapshot.files, sourcePaths);
  for (const sourcePath of sourcePaths) {
    const path = resolve(sourceRoot, sourcePath);
    const stat = await lstat(path);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 65536, 'Source must be a bounded regular file.');
    assert.match(catalog.sourceSnapshot.files[sourcePath], /^[a-f0-9]{64}$/);
    assert.equal(digest(await readFile(path)), catalog.sourceSnapshot.files[sourcePath], 'Source bytes differ from the reviewed snapshot.');
  }
  assert.ok(Array.isArray(catalog.passages) && catalog.passages.length > 0 && catalog.passages.length <= 24);
  const byId = new Map();
  for (const passage of catalog.passages) {
    keys(passage, ['id', 'title', 'sourcePath', 'selector', 'text', 'digest', 'factKey', 'factValue']);
    assert.match(passage.id, /^[a-z][a-z0-9_.]{0,79}$/);
    assert.ok(!byId.has(passage.id), 'Duplicate passage.');
    assert.ok(text(passage.title, 160) && text(passage.selector, 160) && text(passage.text, 512), 'Passage bounds or unsafe text.');
    assert.ok(sourcePaths.includes(passage.sourcePath), 'Unreviewed passage source.');
    assert.equal(passage.text, extract(passage.sourcePath, passage.selector), 'Passage is not the literal selected commercial text.');
    assert.equal(passage.digest, digest(passage.text), 'Passage digest differs.');
    assert.match(passage.factKey, /^[a-z][a-z0-9_.]{0,79}$/);
    assert.match(passage.factValue, /^[a-z][a-z0-9_]{0,79}$/);
    byId.set(passage.id, passage);
  }
  assert.ok(Array.isArray(catalog.answers) && catalog.answers.length > 0 && catalog.answers.length <= 24);
  const answerIds = new Set(), recipes = new Set(), allowedActions = getActionCatalog();
  for (const answer of catalog.answers) {
    keys(answer, ['id', 'passageIds', 'prefix', 'suffix', 'actionIds']);
    assert.match(answer.id, /^[a-z][a-z0-9_]{0,63}$/);
    assert.ok(!answerIds.has(answer.id), 'Duplicate answer.');
    answerIds.add(answer.id);
    assert.ok(Array.isArray(answer.passageIds) && answer.passageIds.length > 0 && answer.passageIds.length <= 3);
    const selected = answer.passageIds.map(id => byId.get(id));
    assert.equal(hasConflictingGroundingFacts(selected), false, 'Invalid, excessive or contradictory reviewed fact selection.');
    assert.ok(answer.prefix === '' || text(answer.prefix, 256));
    assert.ok(answer.suffix === '' || text(answer.suffix, 256));
    const answerText = [answer.prefix, ...selected.map(passage => passage.title + ':\n' + passage.text), answer.suffix].filter(Boolean).join('\n\n');
    assert.ok([...answerText].length <= 3000, 'Answer character limit.');
    assert.ok(Array.isArray(answer.actionIds) && answer.actionIds.length <= 6 &&
      answer.actionIds.every(id => Object.hasOwn(allowedActions, id)) && new Set(answer.actionIds).size === answer.actionIds.length, 'Unreviewed or duplicate action.');
    const identity = JSON.stringify([answerText, answer.passageIds, answer.actionIds]);
    assert.ok(!recipes.has(identity), 'Ambiguous duplicate answer recipe.');
    recipes.add(identity);
  }
  return Object.freeze({ status: 'passed', catalogDigest: expectedDigest, sourceFiles: sourcePaths.length,
    passages: byId.size, answers: answerIds.size, commercialSourceExecution: false, operationalAuthority: false });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.argv.length, 2, 'No arguments are accepted.');
    console.log('FAISCA_GROUNDING_CATALOG_PASS ' + JSON.stringify(await verifyGroundingCatalog()));
  } catch (error) {
    console.error('FAISCA_GROUNDING_CATALOG_FAIL ' + error.message);
    process.exitCode = 1;
  }
}
