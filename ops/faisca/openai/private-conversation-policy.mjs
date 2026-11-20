import { createSession, respond } from '../core.mjs';
import { getGroundedAnswer } from '../grounding/guide.mjs';
import { hasPrivateIdentifierRisk } from './private-identifier-risk.mjs';

const normalize = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const money = /r\$|[$€£]|\b(?:precos?|valores?|cust[ao]s?|cobra[mn]?|cobram|cobranca|orcamentos?|cotacao|investimento|descontos?|pagamentos?|parcelas?|mensalidades?|reais|brl|usd|pagar|comercializa|gratuit[oa]s?|bonificacoes?)\b/;
const businessFlow = /\b(?:processo|fluxo|etapas?|aprov\w*|revis\w*|entrega\w*|prazo\w*|implantacao|cria\w*|produ\w*|contrat\w*|suporte|escopo|procedimento|envi\w*)\b/;
const company = /\b(?:imagine|voces?|equipe|intern[oa]s?|cliente)\b/;
const broadProcess = /\b(?:como funciona|quais sao as etapas|quais as etapas|qual e o processo)\b/;
const otherFlowDetails = /\b(?:layout|link|portal|prazo|aprov\w*|envi\w*|revis\w*|suporte|entrega\w*)\b/;
const rejectInput = new Set(['sensitive_input', 'unsupported_instruction', 'invalid_input', 'too_long']);
const blockedTopics = new Set(['support_status', 'support_issue', 'support_billing',
  'support_cancel', 'after_sales', 'human', 'privacy', 'goal_sales']);

export function privateConversationRoute(question) {
  const { reply } = respond(createSession(), { type: 'text', text: question });
  if (rejectInput.has(reply.intent)) return 'rejected';
  if (blockedTopics.has(reply.intent)) return 'confirm';

  const text = normalize(question);
  if (money.test(text)) return 'pricing';
  if (businessFlow.test(text) && (company.test(text) || /\b(?:meu|minha|nosso|nossa)\b/.test(text))) {
    if (broadProcess.test(text) && businessFlow.test(text) && !otherFlowDetails.test(text)) return 'process';
    return 'confirm';
  }
  return 'classify';
}

export function privateConversationEditorialReply(route) {
  const approved = ['pricing', 'process'].includes(route) ? getGroundedAnswer(route) : null;
  return {
    status: approved ? 'editorial_answer' : 'needs_confirmation',
    text: approved?.text ?? 'Essa informação precisa ser confirmada com a equipe da Imagine.',
    sourceIds: approved?.sources.map(source => source.id) ?? [],
    modelIds: [],
    publicReady: false,
    operationalEffects: false
  };
}

export function safePrivateGeneralReply(text) {
  const normalized = normalize(text);
  return !hasPrivateIdentifierRisk(text) && !money.test(normalized) && !/\b(?:imagine|faisca)\b/.test(normalized) &&
    !/\b(?:nosso|nossa|oferecemos|entregamos|garantimos|aprovamos|enviamos|cobramos)\b/.test(normalized);
}
