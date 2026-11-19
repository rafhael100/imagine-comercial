import { mountFaisca } from '../ui.mjs';
import {
  createSupportJourney, respondSupportJourney, getSupportJourneySummary
} from './journey.mjs';

const supportWelcome = Object.freeze({
  text: 'Olá! Sou o Faísca. Esta é uma prévia anônima de orientação pós-venda, sem consulta de cliente, contrato ou pedido. Escolha o botão Organizar atendimento para selecionar o assunto. Não digite dados pessoais ou senhas: esta triagem usa somente opções fechadas e não abre tickets.',
  intent: 'r10_support_welcome',
  state: 'TALK',
  sources: Object.freeze([]),
  actions: Object.freeze([Object.freeze({ id: 'after_sales', label: 'Organizar atendimento' })])
});

export function getSupportWelcome() { return supportWelcome; }

const policy = Object.freeze({
  create: createSupportJourney,
  summary: getSupportJourneySummary,
  welcome: getSupportWelcome
});

/** Local-only R10 support: no customer identity, persistence or external calls. */
export function mountSupport(root) {
  const mounted = mountFaisca(root, {
    prepareTurn: respondSupportJourney,
    sessionPolicy: policy,
    replyDelayMs: 110
  });
  root.dataset.faiscaMode = 'r10_anonymous_support_lab';
  return mounted;
}
