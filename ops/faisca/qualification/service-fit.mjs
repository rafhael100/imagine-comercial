import { validateLeadProfile, isQualificationComplete } from './profile.mjs';

export const SERVICE_FIT_SCHEMA = 'faisca.service-fit.review.v1';

// Fixed editorial signals only. These are prompts to review the selection,
// not rankings, a promise of results or proof of a better offer.
const reviewCases = Object.freeze({
  onepage: Object.freeze({
    capture_leads: Object.freeze({
      alternativeService: 'landing-page',
      text: 'Você confirmou Site Onepage, mas informou que quer captar contatos. Vale comparar também com Landing Page antes de solicitar uma proposta. Sua escolha atual foi mantida.'
    })
  }),
  'landing-page': Object.freeze({
    present_company: Object.freeze({
      alternativeService: 'onepage',
      text: 'Você confirmou Landing Page, mas informou que deseja apresentar a empresa. Vale comparar também com Site Onepage antes de solicitar uma proposta. Sua escolha atual foi mantida.'
    })
  })
});

/** Only trusted, complete, enumerated R08 profiles are eligible for review. */
export function reviewQualificationServiceFit(profile) {
  const safe = validateLeadProfile(profile);
  if (!safe || !isQualificationComplete(safe)) return null;
  const review = reviewCases[safe.service]?.[safe.objective] ?? null;
  return Object.freeze({
    schema: SERVICE_FIT_SCHEMA,
    selectedService: safe.service,
    status: review ? 'consider_alternative' : 'no_heuristic_conflict',
    alternativeService: review?.alternativeService ?? null,
    text: review?.text ?? '',
    reviewOnly: true,
    selectionChanged: false,
    orderCreated: false,
    contactCollected: false,
    operationalEffects: false
  });
}
