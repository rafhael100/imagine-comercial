import { createSession, getSummary } from '../core.mjs';
import { groundedRespond } from '../grounding/guide.mjs';

export const JOURNEY_VERSION = 'faisca-journey-r07-1';

const trusted = new WeakSet();
const proposedGoals = new Set([
  'goal_presence', 'goal_campaign', 'goal_sales', 'goal_ads',
  'channel_google', 'channel_meta'
]);
const informational = new Set(['channel_compare', 'compare_sites']);
const actionLabels = Object.freeze({
  confirm_goal: 'Confirmar meu objetivo',
  cancel_goal: 'Não, quero avaliar outra opção',
  sell: 'Conhecer outras soluções',
  summary: 'Ver meu resumo'
});

function reply(text, intent, actionIds = ['sell', 'summary']) {
  return Object.freeze({
    text, intent, state: 'TALK', sources: Object.freeze([]),
    actions: Object.freeze(actionIds.map(id => Object.freeze({ id, label: actionLabels[id] })))
  });
}

function readSpecialAction(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input))) return null;
    const keys = Reflect.ownKeys(input);
    if (keys.length !== 2 || !keys.includes('type') || !keys.includes('id')) return null;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (!Object.hasOwn(descriptors.type, 'value') || !Object.hasOwn(descriptors.id, 'value') ||
        descriptors.type.value !== 'action' || typeof descriptors.id.value !== 'string') return null;
    return descriptors.id.value;
  } catch { return null; }
}

function createState(coreSession, pendingGoal, turnIndex) {
  // Expose only the existing public selection fields for the shared visual shell.
  // The authoritative R07 session remains the opaque coreSession reference.
  const session = Object.freeze({ ...coreSession, version: JOURNEY_VERSION, coreSession, pendingGoal, turnIndex });
  trusted.add(session);
  return session;
}

/** R07 is an opt-in, ephemeral wrapper. The R06 session format is unchanged. */
export function createJourney() {
  return createState(createSession(), null, 0);
}

export function getJourneySummary(session) {
  return trusted.has(session) ? getSummary(session.coreSession) : getSummary(createSession());
}

function conclude(session, coreSession, pendingGoal, inner) {
  return Object.freeze({
    session: createState(coreSession, pendingGoal, session.turnIndex + 1),
    userText: inner.userText,
    reply: inner.reply
  });
}

/**
 * R07 only commits goal/solution selection after an explicit confirmation.
 * This module neither calls an LLM nor executes a CRM effect.
 */
export function respondJourney(session, input) {
  if (!trusted.has(session)) {
    const clean = createJourney();
    return conclude(clean, clean.coreSession, null, {
      userText: '[Contexto inválido]',
      reply: reply('A conversa precisa ser reiniciada para manter as escolhas seguras.', 'journey_invalid')
    });
  }

  const special = readSpecialAction(input);
  if (special === 'cancel_goal') {
    return conclude(session, session.coreSession, null, {
      userText: actionLabels.cancel_goal,
      reply: reply('Tudo bem. Nenhuma nova solução foi registrada. Qual caminho você deseja avaliar?',
        'journey_cancelled')
    });
  }
  if (special === 'confirm_goal') {
    if (!session.pendingGoal) {
      return conclude(session, session.coreSession, null, {
        userText: actionLabels.confirm_goal,
        reply: reply('Não há uma escolha pendente de confirmação. Primeiro escolha o assunto que deseja avaliar.',
          'journey_no_pending')
      });
    }
    const confirmed = groundedRespond(session.coreSession, { type: 'action', id: session.pendingGoal });
    if (confirmed.reply.intent !== session.pendingGoal) {
      return conclude(session, session.coreSession, null, {
        userText: '[Confirmação não aplicada]',
        reply: reply('Não foi possível confirmar a escolha com a base disponível. Escolha novamente.',
          'journey_confirmation_refused')
      });
    }
    return conclude(session, confirmed.session, null, confirmed);
  }

  const inner = groundedRespond(session.coreSession, input);
  if (inner.reply.intent === 'summary') {
    return conclude(session, session.coreSession, session.pendingGoal, {
      userText: inner.userText,
      reply: reply(inner.reply.text, 'journey_summary')
    });
  }
  if (proposedGoals.has(inner.reply.intent)) {
    return conclude(session, session.coreSession, inner.reply.intent, {
      userText: inner.userText,
      reply: reply('Posso registrar este objetivo para orientar o atendimento. Confirme a escolha ou continue avaliando outras opções; nenhuma seleção foi alterada até sua confirmação.',
        'journey_confirmation_needed', ['confirm_goal', 'cancel_goal'])
    });
  }

  // Comparisons are informational, not evidence that the visitor selected ads.
  // Private/post-sale questions likewise cannot silently replace a sales goal.
  const safeCore = informational.has(inner.reply.intent) || inner.reply.intent === 'grounding_boundary'
    ? session.coreSession : inner.session;
  return conclude(session, safeCore, session.pendingGoal, inner);
}
