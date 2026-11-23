import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseUniquePrivateEvidenceJson as parse } from
  '../ops/faisca/staging/parse-unique-private-evidence-json.mjs';

const HOLD = 'R259: two-listener private boundary unverified (HOLD)\n';
const cli = fileURLToPath(new URL(
  '../scripts/faisca-review-two-listener-boundary.mjs', import.meta.url
));

test('R261 accepts synthetic nested Docker inspect data without duplicate keys', () => {
  const text = '{"container":[{"Config":{"Env":["SYNTHETIC=1"]},"State":{"Running":true}}],"image":[{"Id":"sha256:fixture"}]}';
  const parsed = parse(text);
  assert.equal(parsed.container[0].State.Running, true);
  assert.equal(parsed.image[0].Id, 'sha256:fixture');
});

test('R261 rejects duplicate members at all levels, including unicode aliases', () => {
  for (const text of [
    '{"container":[{}],"container":[{}],"image":[{}]}',
    '{"container":[{"Id":"first","Id":"second"}],"image":[{}]}',
    '{"container":[{"Image":"first","\\u0049mage":"second"}],"image":[{}]}',
    '{"container":[{"Config":{"Env":[],"Env":["BAD"]}}],"image":[{}]}',
    '{"container":[{"nested":[{"Id":1,"Id":2}]}],"image":[{}]}'
  ]) assert.throws(() => parse(text), /invalid private evidence JSON|not allowed/i);
});

test('R261 permits equal member names in separate inspect objects', () => {
  const parsed = parse('{"container":[{"Id":"one"}],"image":[{"Id":"two"}]}');
  assert.deepEqual([parsed.container[0].Id, parsed.image[0].Id], ['one', 'two']);
});

test('R261 bounds depth and refuses malformed or non-text evidence', () => {
  assert.throws(() => parse('{ "container": '));
  assert.throws(() => parse('true trailing'));
  assert.throws(() => parse('['.repeat(66) + '0' + ']'.repeat(66)));
  assert.throws(() => parse(7));
  assert.throws(() => parse(' '.repeat(512 * 1024 + 1)));
});

test('R261 operator CLI fails closed on duplicate keys without echoing evidence', () => {
  const child = spawnSync(process.execPath, [cli], {
    input: '{"container":[{"SYNTHETIC_SECRET":"first"}],"container":[{}],"image":[{}]}',
    encoding: 'utf8', timeout: 8000,
    env: {
      ...process.env, CI: '', GITHUB_ACTIONS: '',
      IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '1',
      IMAGINE_FAISCA_NGINX_IMAGE: 'synthetic-image',
      IMAGINE_FAISCA_STAGING_WORKDIR: '/synthetic/work',
      IMAGINE_FAISCA_STAGING_SITE_DIR: '/synthetic/site',
      IMAGINE_FAISCA_STAGING_HTPASSWD_PATH: '/synthetic/auth'
    }
  });
  assert.equal(child.status, 2);
  assert.equal(child.stdout, '');
  assert.equal(child.stderr, HOLD);
  assert.doesNotMatch(child.stderr, /SYNTHETIC_SECRET|synthetic-image|\/synthetic/);
});
