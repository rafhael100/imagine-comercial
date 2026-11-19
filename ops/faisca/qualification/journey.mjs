import { createJourney, getJourneySummary, respondJourney } from '../journey/state.mjs';
import { routeFieldWithLocalFixture } from '../model-router/field-contract.mjs';
import { buildQualificationNextStep } from './next-step.mjs';
import {
  createLeadProfileFromJourney, updateLeadProfile, reviseLeadProfile,
  getNextQualificationQuestion, isQualificationComplete, buildHandoffPackage
} from './profile.mjs';

export const QUALIFICATION_JOURNEY_VERSION = 'faisca-qualification-journey-r08-1';
const trusted = new WeakSet();

const labels = Object.freeze({
  sell: 'Conhecer soluções',
  summary: 'Ver resumo parcial',
  changeService: 'Trocar solução',
  restart: 'Reiniciar atendimento'
});
const editLabels = Object.freeze({ objective: 'objetivo', audience: 'público', materials: 'materiais', timeline: 'previsão', contactConsent: 'autorização de contato' });

function readInput(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input))) return null;
    const keys = Reflect.ownKeys(input);
    if (keys.length !== 2 || !keys.includes('type')) return null;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (!Object.hasOwn(descriptors.type, 'value') || !Object.hasOwn(descriptors.id ?? descriptors.text ?? {}, 'value')) return null;
    if (descriptors.type.value === 'action' && keys.includes('id') &&
        typeof descriptors.id.value === 'string' &&
        descriptors.id.value.length > 0 && descriptors.id.value.length <= 96 &&
        /^[a-z0-9:_.-]+$/.test(descriptors.id.value)) {
      // R58: bounded ASCII action IDs, never free text or control characters.
      // Unknown IDs use the existing closed fallback without echoing the input.
      return Object.freeze({ type: 'action', id: descriptors.id.value });
    }
    if (descriptors.type.value === 'text' && keys.includes('text') &&
        typeof descriptors.text.value === 'string' && descriptors.text.value.length <= 800) {
      return Object.freeze({ type: 'text', text: descriptors.text.value });
    }
    return null;
  } catch { return null; }
}

function makeReply(text, intent, sources = [], actions = []) {
  return Object.freeze({
    text, intent, state: 'TALK', sources: Object.freeze(sources),
    actions: Object.freeze(actions.map(item => Object.freeze({ id: item.id, label: item.label })))
  });
}

function action(id, label) { return Object.freeze({ id, label }); }

function advanceJourney(journey) {
  return respondJourney(journey, { type: 'action', id: 'summary' }).session;
}

function createState(journey, profile, phase, previousPhase = null) {
  const session = Object.freeze({
    ...journey,
    version: QUALIFICATION_JOURNEY_VERSION,
    journey, profile, phase,
    ...(previousPhase ? { previousPhase } : {})
  });
  trusted.add(session);
  return session;
}

export function createQualificationJourney() {
  return createState(createJourney(), null, 'sales');
}

export function getQualificationSummary(session) {
  if (!trusted.has(session)) return getJourneySummary(createJourney());
  if (!session.profile) return getJourneySummary(session.journey);
  return buildHandoffPackage(session.profile)?.summary ?? getJourneySummary(session.journey);
}

function serviceChoiceReply(session, text = 'Qual solução você deseja avaliar?', userText = labels.changeService) {
  const hasProfile = Boolean(session.profile);
  return Object.freeze({
    session: createState(session.journey, session.profile,
      hasProfile ? 'service_reselect' : 'sales', hasProfile ? session.phase : null),
    userText,
    reply: makeReply(text, 'r08_service_choice', [], [
      action('goal_presence', 'Site Onepage'),
      action('goal_campaign', 'Landing Page'),
      ...(hasProfile ? [action('r08:keep_service', 'Manter a solução atual')] : [])
    ])
  });
}

function questionReply(session, profile, prefix = '', sources = [], userText = '') {
  const next = getNextQualificationQuestion(profile);
  if (!next) {
    const handoff = buildHandoffPackage(profile);
    return Object.freeze({
      session: createState(session.journey, profile, 'complete'),
      userText,
      reply: makeReply((prefix ? prefix + '\n\n' : '') + handoff.summary, 'r08_qualification_complete', sources, [
        action('r08:edit:objective', 'Corrigir objetivo'),
        action('r08:edit:audience', 'Corrigir público'),
        action('r08:edit:materials', 'Corrigir materiais'),
        action('r08:edit:timeline', 'Corrigir previsão'),
        action('r08:edit:contactConsent', 'Corrigir autorização'),
        // Keep the closed HTTP response under six actions. Changing service
        // remains available from the explicit next-step menu.
        action('r08:next_steps', 'Como avançar?')
      ])
    });
  }
  const options = next.options.map(option => action('r08:' + next.field + ':' + option.value, option.label));
  return Object.freeze({
    session: createState(session.journey, profile, 'qualification'),
    userText,
    reply: makeReply((prefix ? prefix + '\n\n' : '') + next.prompt, 'r08_qualification_question', sources, [
      ...options, action('r08:summary', labels.summary)
    ])
  });
}

function summaryReply(session, userText = labels.summary) {
  const handoff = buildHandoffPackage(session.profile);
  if (!isQualificationComplete(session.profile)) {
    return questionReply(session, session.profile, handoff.summary, [], userText);
  }
  const actions = session.phase === 'complete'
    ? [
      action('r08:edit:objective', 'Corrigir objetivo'),
      action('r08:edit:audience', 'Corrigir público'),
      action('r08:edit:materials', 'Corrigir materiais'),
      action('r08:edit:timeline', 'Corrigir previsão'),
      action('r08:edit:contactConsent', 'Corrigir autorização'),
      action('r08:next_steps', 'Como avançar?')
    ]
    : [action('r08:change_service', labels.changeService)];
  return Object.freeze({
    session,
    userText,
    reply: makeReply(handoff.summary, 'r08_qualification_summary', [], actions)
  });
}

function nextStepReply(session) {
  const guide = session.profile ? buildQualificationNextStep(session.profile) : null;
  if (!guide || !guide.complete || session.phase !== 'complete') {
    if (session.profile) return questionReply(session, session.profile,
      'Primeiro conclua as perguntas de qualificação antes de avançar.', [], 'Como avançar?');
    return serviceChoiceReply(session, 'Primeiro escolha a solução que deseja avaliar.', 'Como avançar?');
  }
  return Object.freeze({
    session,
    userText: 'Como avançar?',
    reply: makeReply(guide.text, 'r08_next_steps', [], [
      action('r08:summary', 'Rever resumo copiável'),
      action('compare_sites', 'Comparar Onepage e Landing Page'),
      action('r08:change_service', labels.changeService),
      action('r08:edit:objective', 'Corrigir minhas respostas')
    ])
  });
}

function freshReply() {
  const session = createQualificationJourney();
  return Object.freeze({
    session,
    userText: '[Contexto reiniciado]',
    reply: makeReply('Vamos começar novamente. Qual solução você deseja avaliar?', 'r08_restart', [], [
      action('goal_presence', 'Site Onepage'),
      action('goal_campaign', 'Landing Page')
    ])
  });
}

/** Local qualification controller. No CRM, persistence, contact data or model call. */
export function respondQualificationJourney(session, rawInput) {
  if (!trusted.has(session)) return freshReply();
  const input = readInput(rawInput);
  if (!input) {
    return Object.freeze({
      session,
      userText: '',
      reply: makeReply('Não consegui validar essa escolha. Use uma das opções disponíveis para continuar.',
        'r08_invalid_input', [], [action('r08:summary', labels.summary)])
    });
  }

  if (input.type === 'action' && input.id === 'r08:restart') return freshReply();
  if (input.type === 'action' && input.id === 'r08:change_service') {
    return serviceChoiceReply(session, 'Sem problema. Vamos rever a solução antes de continuar a qualificação.');
  }
  if (session.phase === 'service_reselect') {
    if (input.type === 'action' && input.id === 'r08:keep_service') {
      const restoredPhase = session.previousPhase === 'complete' ? 'complete' : 'qualification';
      return questionReply(createState(session.journey, session.profile, restoredPhase),
        session.profile, 'Tudo bem. Vamos manter a solução atual.', [], 'Manter a solução atual');
    }
    if (input.type === 'action' && ['goal_presence', 'goal_campaign'].includes(input.id)) {
      const result = respondJourney(session.journey, input);
      if (result.session.pendingGoal !== null) {
        return Object.freeze({
          session: createState(result.session, session.profile, 'service_change_pending', session.previousPhase ?? 'qualification'),
          userText: result.userText,
          reply: result.reply
        });
      }
    }
    return serviceChoiceReply(session, 'Escolha a nova solução ou mantenha a atual.');
  }
  if (session.phase === 'service_change_pending') {
    if (input.type === 'action' && input.id === 'confirm_goal') {
      const result = respondJourney(session.journey, input);
      const profile = createLeadProfileFromJourney(result.session);
      if (profile) {
        const prepared = questionReply(createState(result.session, profile, 'qualification'),
          profile, result.reply.text, result.reply.sources, result.userText);
        return result.reply.sources.length
          ? Object.freeze({ ...prepared, providerReply: result.reply }) : prepared;
      }
      return Object.freeze({
        session: createState(result.session, null, 'sales'),
        userText: result.userText,
        reply: makeReply(result.reply.text + '\\n\\nA qualificação estruturada R08 ainda não tem um questionário aprovado para esta solução. Posso continuar com orientações gerais.',
          'r08_service_qualification_unavailable', result.reply.sources, [action('sell', labels.sell)])
      });
    }
    if (input.type === 'action' && input.id === 'cancel_goal') {
      const result = respondJourney(session.journey, input);
      const restoredPhase = session.previousPhase === 'complete' ? 'complete' : 'qualification';
      return questionReply(createState(result.session, session.profile, restoredPhase),
        session.profile, result.reply.text, [], result.userText);
    }
    if (input.type === 'action' && input.id === 'r08:summary' && session.profile) {
      return Object.freeze({
        session,
        userText: labels.summary,
        reply: makeReply(getQualificationSummary(session) + '\\n\\nUma troca de solução está pendente. Confirme ou cancele para continuar.',
          'r08_service_change_pending', [], [action('confirm_goal', 'Confirmar a troca'), action('cancel_goal', 'Manter a solução atual')])
      });
    }
    return Object.freeze({
      session,
      // The pending-confirmation branch bypasses the standard R07 preflight.
      // Never echo visitor prose here: it might contain credentials or PII.
      userText: input.type === 'text' ? '[Mensagem livre não registrada]' : '[Ação não aplicada]',
      reply: makeReply('Uma troca de solução está pendente. Confirme a nova opção ou cancele para manter o atendimento atual.',
        'r08_service_change_pending', [], [action('confirm_goal', 'Confirmar a troca'), action('cancel_goal', 'Manter a solução atual')])
    });
  }
  if (input.type === 'action' && input.id === 'r08:summary' && session.profile) {
    return summaryReply(session);
  }
  if (input.type === 'action' && input.id === 'r08:next_steps') {
    return nextStepReply(session);
  }

  if (session.phase === 'qualification' || session.phase === 'complete') {
    if (input.type === 'action' && input.id.startsWith('r08:edit:')) {
      const field = input.id.slice('r08:edit:'.length);
      const revised = reviseLeadProfile(session.profile, field);
      if (!revised) return summaryReply(session, 'Não consegui abrir essa correção. Confira o resumo e escolha um campo disponível.');
      return questionReply(createState(advanceJourney(session.journey), revised, session.phase), revised,
        'Vamos corrigir esta informação.', [], 'Corrigir ' + editLabels[field]);
    }

    if (input.type === 'action' && input.id.startsWith('r08:')) {
      const parts = input.id.split(':');
      if (parts.length === 3) {
        const [, field, value] = parts;
        const currentQuestion = getNextQualificationQuestion(session.profile);
        const selectedOption = currentQuestion?.field === field
          ? currentQuestion.options.find(option => option.value === value) : null;
        const updated = updateLeadProfile(session.profile, field, value);
        if (updated) return questionReply(createState(advanceJourney(session.journey), updated, session.phase),
          updated, '', [], selectedOption?.label ?? 'Escolha registrada');
      }
      return questionReply(session, session.profile, 'Escolha uma das opções da pergunta atual.');
    }
  }

  if (input.type === 'action' && input.id === 'sell') {
    return serviceChoiceReply(session, 'Qual solução você deseja avaliar?', labels.sell);
  }

  if (session.phase === 'qualification' || session.phase === 'complete') {
    if (session.phase === 'qualification' && input.type === 'text' && session.profile) {
      const currentQuestion = getNextQualificationQuestion(session.profile);
      if (currentQuestion) {
        const fieldResult = routeFieldWithLocalFixture({
          conversationId: 'r08-local-field',
          messageId: 'r08-field-' + String(session.journey.turnIndex).padStart(8, '0'),
          userText: input.text,
          field: currentQuestion.field
        });
        if (fieldResult.accepted && fieldResult.status === 'matched') {
          const updated = updateLeadProfile(session.profile, fieldResult.field, fieldResult.value);
          if (updated) {
            // Display only an approved option label, never the untrusted raw
            // text from a free-form answer in the chat transcript.
            const choice = currentQuestion.options.find(option => option.value === fieldResult.value);
            return questionReply(createState(advanceJourney(session.journey), updated, session.phase),
              updated, '', [], choice?.label ?? '[Opção escolhida]');
          }
        }
        if (fieldResult.accepted && fieldResult.status === 'ambiguous') {
          return questionReply(createState(advanceJourney(session.journey), session.profile, session.phase),
            session.profile, 'Encontrei mais de uma interpretação possível. Escolha a alternativa que melhor representa sua resposta.',
            [], '[Resposta ambígua — escolha uma opção]');
        }
      }
    }
    if (input.type === 'text' || input.type === 'action') {
      const result = respondJourney(session.journey, input);
      if (result.session.pendingGoal !== null) {
        return Object.freeze({
          session: createState(result.session, session.profile, 'service_change_pending', session.phase),
          userText: result.userText,
          reply: Object.freeze({
            ...result.reply,
            text: 'Uma troca de solução está pendente. Sua qualificação atual será mantida até você confirmar a troca.\n\n' +
              result.reply.text
          })
        });
      }
      if (result.reply.intent === 'journey_summary') {
        return summaryReply(createState(result.session, session.profile, session.phase), result.userText);
      }
      const prepared = questionReply(createState(result.session, session.profile, session.phase),
        session.profile, result.reply.text, result.reply.sources, result.userText);
      return result.reply.sources.length
        ? Object.freeze({ ...prepared, providerReply: result.reply }) : prepared;
    }
  }

  const result = respondJourney(session.journey, input);
  const confirmedService = result.reply.intent === 'goal_presence' || result.reply.intent === 'goal_campaign';
  if (confirmedService) {
    const profile = createLeadProfileFromJourney(result.session);
    if (profile) {
      const prepared = questionReply(createState(result.session, profile, 'qualification'),
        profile, result.reply.text, result.reply.sources, result.userText);
      return result.reply.sources.length
        ? Object.freeze({ ...prepared, providerReply: result.reply }) : prepared;
    }
  }
  if (['goal_sales', 'goal_ads', 'channel_google', 'channel_meta'].includes(result.reply.intent) &&
      result.session.pendingGoal === null) {
    return Object.freeze({
      session: createState(result.session, null, 'sales'),
      userText: result.userText,
      reply: makeReply(result.reply.text + '\n\nA qualificação estruturada R08 ainda não tem um questionário aprovado para esta solução. Posso continuar com as orientações gerais.',
        'r08_service_qualification_unavailable', result.reply.sources, [action('sell', labels.sell)])
    });
  }
  const prepared = Object.freeze({
    session: createState(result.session, null, 'sales'),
    userText: result.userText,
    reply: result.reply
  });
  return result.reply.sources.length
    ? Object.freeze({ ...prepared, providerReply: result.reply }) : prepared;
}
