import {
  validateLeadProfile, isQualificationComplete
} from './profile.mjs';
import { buildFaiscaPortalReadiness } from './portal-readiness.mjs';

export const NEXT_STEP_SCHEMA = 'faisca.qualification-next-step.v1';
const serviceLabels = Object.freeze({ onepage: 'Site Onepage', 'landing-page': 'Landing Page' });

/**
 * R17: post-qualification guidance derived exclusively from trusted enumerated
 * R08 fields. No contact, checkout, CRM, ticket, URL or payment operation.
 */
export function buildQualificationNextStep(profile) {
  const safe = validateLeadProfile(profile);
  if (!safe) return null;
  const complete = isQualificationComplete(safe);
  const service = serviceLabels[safe.service];
  if (!service) return null;
  const portal = complete ? buildFaiscaPortalReadiness(safe) : null;
  const portalStatus = portal?.text ??
    'A disponibilidade do Portal não pôde ser confirmada nesta prévia; nenhuma contratação está habilitada.';

  const text = complete
    ? [
        'Como avançar com ' + service + ' — orientação do Faísca',
        '1. Confira o resumo de interesse e corrija qualquer escolha antes de utilizá-lo.',
        '2. Copie o resumo pelo botão da conversa, se desejar compartilhar com a equipe por um canal oficial confirmado.',
        '3. Disponibilidade atual no Imagine Comercial: ' + portalStatus,
        '4. Escopo, valores e condições finais dependem de validação oficial no Portal Imagine quando houver um fluxo autorizado.',
        'Nenhum contato, pedido, proposta, cobrança, chamado ou agendamento foi criado. Esta prévia não enviou o resumo à equipe nem ao CRM.'
      ].join('\n')
    : [
        'Para avançar com ' + service + ', conclua primeiro as perguntas de qualificação.',
        'Suas respostas são escolhas de laboratório, não uma contratação. Nenhum dado de contato será solicitado nem enviado nesta prévia.'
      ].join('\n');

  return Object.freeze({
    schema: NEXT_STEP_SCHEMA, service: safe.service,
    complete, text, delivery: 'copy_only',
    portalReadinessCode: portal?.readinessCode ?? 'unverified',
    portalPublicCheckoutAuthorized: false,
    sent: false, contactCollected: false,
    orderCreated: false, paymentCreated: false,
    ticketCreated: false, operationalEffects: false
  });
}
