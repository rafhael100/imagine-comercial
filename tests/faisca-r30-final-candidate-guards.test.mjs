import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { publicFaiscaEnabled } from '../ops/faisca/lab/lab-policy.mjs';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';
import { assessPublicPortalReadiness } from '../src/lib/public-portal-checkout-readiness.mjs';
import { reviewedQuoteChoiceHref } from '../src/data/reviewed-quote-choice-href.mjs';
import { reviewedQuoteChoiceMessage } from '../src/data/reviewed-quote-choice-messages.mjs';
import { contactWhatsAppUrl, contactChannels } from '../src/data/contact-channels.mjs';
import { startPortablePrivateReview } from '../ops/faisca/composition/portable-launcher.mjs';

const choose = (session, id) =>
  respondQualificationJourney(session, { type: 'action', id });

test('R30 does not activate public Faísca, quote checkout, redirect or charge', () => {
  assert.equal(publicFaiscaEnabled, false);
  const status = assessPublicPortalReadiness({ site: 'onepage', channels: [], tier: 'minimum' });
  assert.equal(status.publicCheckoutAuthorized, false);
  assert.equal(status.automaticChargeAuthorized, false);
  assert.equal(status.portalLoginOrRedirectAuthorized, false);
  assert.equal(status.finalServerRepricingRequired, true);
});

test('R30 retains the R27 privacy correction during a proposed service change', () => {
  let session = choose(createQualificationJourney(), 'goal_presence').session;
  session = choose(session, 'confirm_goal').session;
  session = choose(session, 'r08:objective:present_company').session;
  session = choose(session, 'r08:change_service').session;
  session = choose(session, 'goal_campaign').session;
  assert.equal(session.phase, 'service_change_pending');
  const sensitive = respondQualificationJourney(session, {
    type: 'text', text: 'Senha R30_SYNTHETIC_SECRET_456'
  });
  assert.equal(sensitive.userText, '[Mensagem livre não registrada]');
  assert.equal(sensitive.reply.intent, 'r08_service_change_pending');
  assert.equal(sensitive.session.profile.service, 'onepage');
  assert.doesNotMatch(JSON.stringify(sensitive), /R30_SYNTHETIC_SECRET_456/);
});

test('R30 preserves reviewed F357 WhatsApp source instead of a duplicated literal phone', () => {
  const selection = { site: 'landing-pages', channels: ['google_ads'], tier: 'minimum' };
  for (const locale of ['pt-BR','en','es']) {
    const message = reviewedQuoteChoiceMessage(locale, selection);
    const href = reviewedQuoteChoiceHref(locale, selection);
    assert.equal(href, contactWhatsAppUrl(message));
    assert.equal(new URL(href).origin + new URL(href).pathname,
      contactChannels.whatsappBaseHref);
    assert.deepEqual([...new URL(href).searchParams.keys()], ['text']);
  }
});

test('R30 portable package refuses unapproved login and preserves the same approved mascot', async () => {
  await assert.rejects(startPortablePrivateReview({
    folder: '/tmp/nonexistent-r30', password: 'too-short'
  }), TypeError);
  const approved = await readFile(new URL('../ops/faisca/assets/faisca-master.png', import.meta.url));
  const digest = createHash('sha256').update(approved).digest('hex');
  assert.equal(digest, '1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d');
});
