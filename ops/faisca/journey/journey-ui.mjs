import { mountFaisca } from '../ui.mjs';
import { createQualificationJourney, getQualificationSummary, respondQualificationJourney } from '../qualification/journey.mjs';
import { validateLeadProfile, isQualificationComplete } from '../qualification/profile.mjs';

/** Only an actively completed qualification permits a copy-only handoff.
 * The old profile remains available while a service change is proposed,
 * but must not authorize a stale quote choice during reselect/pending.
 */
export function getCompletedQuoteSite(session) {
  if (session?.phase !== 'complete') return null;
  const profile = validateLeadProfile(session.profile);
  if (!profile || !isQualificationComplete(profile)) return null;
  return profile.service === 'onepage' ? 'onepage'
    : profile.service === 'landing-page' ? 'landing-pages' : null;
}

const policy = Object.freeze({
  create: createQualificationJourney,
  summary: getQualificationSummary,
  quoteSite: getCompletedQuoteSite
});

/** Opt-in R08 local sales qualification, reusing the approved UI and artwork. */
export function mountJourney(root) {
  const mounted = mountFaisca(root, {
    prepareTurn: respondQualificationJourney,
    sessionPolicy: policy,
    replyDelayMs: 120
  });
  root.dataset.faiscaMode = 'r08_local_qualification';
  return mounted;
}
