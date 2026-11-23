import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewFaiscaPrivateTwoListenerBoundary as review } from
  '../ops/faisca/staging/review-private-two-listener-boundary.mjs';
import { reviewFaiscaPrivateApiAnonymousBoundary } from
  '../ops/faisca/openai/review-private-api-noauth.mjs';
import { startFaiscaOpenAIPrivateReview } from
  '../ops/faisca/openai/private-review-http.mjs';

const HOLD = /R259: two-listener private boundary unverified \(HOLD\)/;
const NGINX = {
  schema: 'faisca.private-full-runtime-cors-review.v1',
  status: 'REPORTED_RUNTIME_AND_23_LOCAL_NOAUTH_HTTP_CHECKS_REVIEW_ONLY',
  reportedDockerRuntimeMatch: true, noAuthGetHeadChecks: 19,
  noAuthOptionsChecks: 4, totalNoAuthChecks: 23,
  noCredentialsSent: true, corsPermissionGranted: false,
  independentlyAuthenticatedOperatorEvidence: false,
  dockerInspectionPerformed: false,
  dockerToHttpProcessOwnershipIndependentlyVerified: false,
  externalNetworkExposureIndependentlyVerified: false,
  authenticatedConversationVerified: false,
  providerSpendReconciled: false, publicReady: false,
  deploymentAuthorized: false, deploymentPerformed: false,
  publicFaiscaEnabled: false
};
const API = {
  schema: 'faisca.private-api-anonymous-boundary.v1',
  status: 'PRIVATE_API_GET_OPTIONS_NOT_FOUND_REVIEW_ONLY',
  negativeRouteChecks: 4, noPostRequestsSent: true,
  noCredentialsSent: true, noOperatorTextSent: true,
  observedOnLoopbackOnly: true,
  authenticatedConversationVerified: false,
  runtimeProcessIndependentlyVerified: false,
  providerSpendReconciled: false, publicReady: false,
  deploymentAuthorized: false, deploymentPerformed: false,
  publicFaiscaEnabled: false
};

test('R259 accepts only two exact reports, in 23 + 4 order', async () => {
  const calls = [];
  const input = Object.freeze({ fixture: true });
  const result = await review(input, {
    nginxReview: async received => {
      calls.push('nginx'); assert.equal(received, input);
      return { ...NGINX };
    },
    apiReview: async opts => {
      calls.push('api'); assert.deepEqual(opts, { port: 4336 });
      return { ...API };
    }
  });
  assert.deepEqual(calls, ['nginx', 'api']);
  assert.equal(result.totalNoAuthChecks, 27);
  assert.equal(result.staticListenerLoopbackPort, 4337);
  assert.equal(result.apiListenerLoopbackPort, 4336);
  assert.equal(result.noPromptsOrPostSent, true);
  assert.equal(result.providerSpendReconciled, false);
  assert.equal(result.authenticatedConversationVerified, false);
  assert.equal(result.publicReady, false);
  assert.equal(result.deploymentPerformed, false);
  assert.equal(result.publicFaiscaEnabled, false);
  assert.ok(Object.isFrozen(result));
  assert.doesNotMatch(JSON.stringify(result), /fixture|token|apikey|https?:/i);
});

test('R259 invalid Nginx report is HOLD BEFORE API access', async t => {
  const mutations = [
    v => { v.noAuthOptionsChecks = 3; },
    v => { v.totalNoAuthChecks = 27; },
    v => { v.providerSpendReconciled = true; },
    v => { v.publicFaiscaEnabled = true; },
    v => { v.added = 'synthetic-secret'; },
    v => { delete v.schema; },
    v => { Object.defineProperty(v, 'status', {
      enumerable: true, get() { throw Error('synthetic-secret'); }
    }); },
    v => { Object.defineProperty(v, Symbol('proof'), {
      value: 'synthetic-secret'
    }); }
  ];
  for (const mutate of mutations) {
    await t.test('untrusted report rejected', async () => {
      const snapshot = { ...NGINX }; mutate(snapshot);
      let apiCalls = 0;
      await assert.rejects(review({}, {
        nginxReview: async () => snapshot,
        apiReview: async () => { apiCalls++; return { ...API }; }
      }), HOLD);
      assert.equal(apiCalls, 0);
    });
  }
});

test('R259 invalid API report is HOLD without partial success', async t => {
  const mutations = [
    v => { v.negativeRouteChecks = 3; },
    v => { v.noPostRequestsSent = false; },
    v => { v.noCredentialsSent = false; },
    v => { v.authenticatedConversationVerified = true; },
    v => { v.runtimeProcessIndependentlyVerified = true; },
    v => { v.publicReady = true; },
    v => { v.added = 'synthetic-secret'; },
    v => { delete v.status; },
    v => { Object.defineProperty(v, 'schema', {
      enumerable: true, get() { throw Error('synthetic-secret'); }
    }); }
  ];
  for (const mutate of mutations) {
    await t.test('untrusted API report rejected', async () => {
      const snapshot = { ...API }; mutate(snapshot);
      await assert.rejects(review({}, {
        nginxReview: async () => ({ ...NGINX }),
        apiReview: async () => snapshot
      }), HOLD);
    });
  }
  await assert.rejects(review({}, {
    nginxReview: async () => { throw Error('synthetic-private-value'); },
    apiReview: async () => ({ ...API })
  }), HOLD);
  await assert.rejects(review({}, {
    nginxReview: async () => ({ ...NGINX }),
    apiReview: async () => { throw Error('synthetic-private-value'); }
  }), HOLD);
});

test('R259 uses actual R95 API with synthetic provider, no paid dispatch', async t => {
  for (const conversation of [false, true]) {
    await t.test('private conversation=' + conversation, async sub => {
      let providerCalls = 0;
      const lab = {
        answer: async () => { providerCalls++; throw Error('unexpected dispatch'); },
        answerPrivateConversation: async () => {
          providerCalls++; throw Error('unexpected dispatch');
        },
        inspect: () => ({ requests: 0 })
      };
      const server = await startFaiscaOpenAIPrivateReview({
        lab, reviewToken: 'x'.repeat(40), port: 0,
        enablePrivateConversation: conversation
      });
      sub.after(async () => server.close());
      const port = Number(new URL(server.address).port);
      const result = await review({}, {
        nginxReview: async () => ({ ...NGINX }), // explicitly synthetic
        apiReview: ({ port: fixed }) => {
          assert.equal(fixed, 4336);
          return reviewFaiscaPrivateApiAnonymousBoundary({ port });
        }
      });
      assert.equal(result.totalNoAuthChecks, 27);
      assert.equal(providerCalls, 0);
      assert.equal(result.authenticatedConversationVerified, false);
    });
  }
});

test('R259 operator CLI guards args, CI, opt-in and non-echo', () => {
  const cli = fileURLToPath(new URL(
    '../scripts/faisca-review-two-listener-boundary.mjs', import.meta.url
  ));
  for (const { args, change } of [
    { args: ['--url', 'https://synthetic.invalid'], change: {} },
    { args: [], change: { CI: '1' } },
    { args: [], change: { GITHUB_ACTIONS: 'true' } },
    { args: [], change: { IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '' } },
    { args: [], change: { IMAGINE_FAISCA_NGINX_IMAGE: '' } }
  ]) {
    const child = spawnSync(process.execPath, [cli, ...args], {
      input: '{"container":[{"SECRET":"fixture"}],"image":[{}]}',
      encoding: 'utf8', timeout: 8000,
      env: {
        ...process.env, CI: '', GITHUB_ACTIONS: '',
        IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '1',
        IMAGINE_FAISCA_NGINX_IMAGE: 'synthetic-image',
        IMAGINE_FAISCA_STAGING_WORKDIR: '/synthetic/work',
        IMAGINE_FAISCA_STAGING_SITE_DIR: '/synthetic/site',
        IMAGINE_FAISCA_STAGING_HTPASSWD_PATH: '/synthetic/auth',
        ...change
      }
    });
    assert.equal(child.status, 2);
    assert.equal(child.stdout, '');
    assert.equal(child.stderr,
      'R259: two-listener private boundary unverified (HOLD)\n');
    assert.doesNotMatch(child.stderr, /SECRET|synthetic-image/);
  }
});
