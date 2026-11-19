import { createSession } from '../core.mjs';
import {
  createSupportSession, inspectSupportSession, getNextSupportQuestion,
  chooseSupportOption, reviseSupportOption, buildSupportBrief
} from './triage.mjs';

export const SUPPORT_JOURNEY_VERSION = 'faisca.support-journey.r10-1';
const trusted = new WeakSet();
const fieldLabels = Object.freeze({
  topic: 'assunto', service: 'serviço', detail: 'detalhe'
});

function makeState(triage) {
  const base = createSession();
  const state = Object.freeze({
    ...base,
    version: SUPPORT_JOURNEY_VERSION,
    journey: 'after_sales',
    goal: null,
    selection: Object.freeze([]),
    supportTopic: triage.topic,
    triage
  });
  trusted.add(state);
  return state;
}

function inputData(raw) {
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) return null;
    const keys = Reflect.ownKeys(raw);
    if (keys.length !== 2 || !keys.includes('type')) return null;
    const d = Object.getOwnPropertyDescriptors(raw);
    if (!d.type || !Object.hasOwn(d.type, 'value')) return null;
    if (d.type.value === 'action' && keys.includes('id') && d.id &&
        Object.hasOwn(d.id, 'value') && typeof d.id.value === 'string' &&
        d.id.value.length > 0 && d.id.value.length <= 96 &&
        /^[a-z0-9:_-]+$/.test(d.id.value)) {
      // UI actions are closed ASCII IDs; reject oversized, control or hidden
      // characters before dispatch, without echoing the supplied identifier.
      return Object.freeze({ type: 'action', id: d.id.value });
    }
    if (d.type.value === 'text' && keys.includes('text') && d.text &&
        Object.hasOwn(d.text, 'value') && typeof d.text.value === 'string') {
      return Object.freeze({ type: 'text' });
    }
    return null;
  } catch { return null; }
}

function makeReply(text, intent, actions = []) {
  return Object.freeze({
    text, intent, state: 'TALK', sources: Object.freeze([]),
    actions: Object.freeze(actions.map(({ id, label }) => Object.freeze({ id, label })))
  });
}
function action(id, label) { return Object.freeze({ id, label }); }

function nextActions(triage) {
  const question = getNextSupportQuestion(triage);
  if (question) {
    const options = question.options.map(option => action('r10:' + question.field + ':' + option.value, option.label));
    return Object.freeze(question.field === 'service'
      ? options : [...options, action('r10:summary', 'Ver resumo parcial')]);
  }
  return Object.freeze([
    action('r10:revise:topic', 'Corrigir assunto'),
    action('r10:revise:service', 'Corrigir serviço'),
    action('r10:revise:detail', 'Corrigir detalhe'),
    action('r10:restart', 'Reiniciar')
  ]);
}

function currentReply(triage, prefix = '', userText = '') {
  const question = getNextSupportQuestion(triage);
  const brief = buildSupportBrief(triage);
  const text = question
    ? (prefix ? prefix + '\n\n' : '') + question.prompt +
      '\n\nEsta demonstração não consulta contratos, pagamentos ou pedidos.'
    : (prefix ? prefix + '\n\n' : '') + brief.summary;
  return Object.freeze({
    session: makeState(triage),
    userText,
    reply: makeReply(text, question ? 'r10_support_question' : 'r10_support_complete',
      nextActions(triage))
  });
}

export function createSupportJourney() {
  return makeState(createSupportSession());
}

export function getSupportJourneySummary(session) {
  if (!trusted.has(session)) return buildSupportBrief(createSupportSession()).summary;
  return buildSupportBrief(session.triage).summary;
}

/** Entirely local anonymous flow: typed data is not saved or echoed. */
export function respondSupportJourney(session, rawInput) {
  if (!trusted.has(session)) {
    const fresh = createSupportSession();
    return currentReply(fresh, 'O atendimento anterior não pôde ser validado. Vamos recomeçar.');
  }
  const input = inputData(rawInput);
  if (!input) return currentReply(session.triage,
    'Não consegui validar a opção. Escolha um dos botões abaixo.');

  if (input.type === 'text') return currentReply(session.triage,
    'Para proteger seus dados, esta triagem anônima aceita apenas as opções disponíveis. Não envie nomes, e-mail, telefone, senhas ou informações de clientes.',
    '[Mensagem livre não registrada]');

  if (input.id === 'r10:restart') return currentReply(createSupportSession(),
    'Atendimento reiniciado. Nenhum ticket foi criado.', 'Reiniciar');

  if (input.id === 'r10:summary') {
    const brief = buildSupportBrief(session.triage);
    const question = getNextSupportQuestion(session.triage);
    if (!question) return Object.freeze({
      session,
      userText: 'Ver resumo',
      reply: makeReply(brief.summary, 'r10_support_summary', nextActions(session.triage))
    });
    return currentReply(session.triage,
      brief.summary + '\n\nVocê pode continuar escolhendo uma opção abaixo.',
      'Ver resumo');
  }
  if (input.id.startsWith('r10:revise:')) {
    const field = input.id.slice('r10:revise:'.length);
    const revised = reviseSupportOption(session.triage, field);
    if (!revised) return currentReply(session.triage, 'Esta correção não está disponível.');
    return currentReply(revised, 'Vamos corrigir o ' + fieldLabels[field] + '.', 'Corrigir ' + fieldLabels[field]);
  }
  if (input.id.startsWith('r10:')) {
    const segments = input.id.split(':');
    if (segments.length === 3) {
      const [, field, value] = segments;
      const next = getNextSupportQuestion(session.triage);
      const option = next?.field === field ? next.options.find(item => item.value === value) : null;
      const changed = chooseSupportOption(session.triage, field, value);
      if (changed && option) return currentReply(changed, '', option.label);
    }
    return currentReply(session.triage, 'Escolha uma das opções apresentadas para a pergunta atual.');
  }
  if (['after_sales', 'home', 'faq', 'human', 'sell'].includes(input.id)) {
    return currentReply(session.triage,
      'Posso ajudar você a organizar o assunto para o suporte. Não consultei nenhum dado de cliente.',
      'Organizar pós-venda');
  }
  return currentReply(session.triage, 'Esta opção não está disponível neste laboratório.');
}
