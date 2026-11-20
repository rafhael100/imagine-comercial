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

// An LLM may make an ungrounded claim that the operator's site/domain was
// already changed, even when it contains no price, contact or Imagine name.
// These are conservative lexical tripwires, not proof of factual correctness.
// This laboratory has NO tool, Portal, DNS or publication authority.
// A model can imply completed publication with paraphrases (launched, online,
// hosted) even without saying `publiquei`. No such actions exist in this lab.
const reportedAction = /\b(?:ja\s+)?(?:publiquei|publicamos|configurei|configuramos|ativei|ativamos|enviei|enviamos|agendei|agendamos|cadastrei|cadastramos|integrei|integramos|instalei|instalamos|criei|criamos|aprovei|aprovamos|contratei|contratamos|finalizei|finalizamos|liberei|liberamos|lancei|lancamos|coloquei|colocamos|subi|subimos|hospedei|hospedamos|disponibilizei|disponibilizamos)\b/;
const completedVisitorAsset = /\b(?:seu|sua|seus|suas)\s+(?:site|pagina|landing\s+page|dominio|campanha|formulario|conta|acesso|pedido|projeto)\b.{0,70}\b(?:ja\s+)?(?:foi|foram|esta|estao)\s+(?:publicad[oa]s?|ativad[oa]s?|ativ[oa]s?|configurad[oa]s?|enviad[oa]s?|cadastrad[oa]s?|contratad[oa]s?|concluid[oa]s?|aprovad[oa]s?|liberad[oa]s?|pront[oa]s?|integrad[oa]s?|online|no\s+ar|rodando|hospedad[oa]s?|disponiveis?|em\s+funcionamento)\b/;
const completedVisitorReceipt = /\b(?:publicacao|ativacao|configuracao|integracao|implantacao|cadastro|aprovacao)\s+(?:do|da|de)\s+(?:seu|sua)\b.{0,70}\b(?:ja\s+)?(?:foi|esta)\s+(?:concluid[oa]|finalizad[oa]|confirmad[oa]|realizad[oa])\b/;

// Deliberately narrow lexical defense against invented certainty of marketing
// outcomes. This does not certify factual correctness or replace editorial review.
// Conservative false positives in the synthetic lab are preferable to
// displaying an unsourced promise to the operator.
const unsupportedOutcomeGuarantee = /\b(?:garante|garantem|garantid[oa]s?|assegura|asseguram|promete|prometem)\b.{0,75}\b(?:vendas?|clientes?|leads?|conversoes?|resultados?|ranqueamento|posicoes?|primeira\s+pagina|primeir[oa]\s+(?:posicao|lugar)|trafego)\b|\b(?:vendas?|clientes?|leads?|conversoes?|resultados?|ranqueamento|posicoes?|primeira\s+pagina|primeir[oa]\s+(?:posicao|lugar)|trafego)\b.{0,55}\bgarantid[oa]s?\b/;

export function hasPrivateUnsupportedOutcomeGuarantee(text) {
  return typeof text !== 'string' || unsupportedOutcomeGuarantee.test(normalize(text));
}

export function hasPrivateOperationalClaim(text) {
  if (typeof text !== 'string') return true;
  const normalized = normalize(text);
  return reportedAction.test(normalized) ||
    completedVisitorAsset.test(normalized) ||
    completedVisitorReceipt.test(normalized);
}

export function safePrivateGeneralReply(text) {
  if (typeof text !== 'string') return false;
  const normalized = normalize(text);
  return !hasPrivateIdentifierRisk(text) && !hasPrivateOperationalClaim(text) &&
    !hasPrivateUnsupportedOutcomeGuarantee(text) && !money.test(normalized) && !/\b(?:imagine|faisca)\b/.test(normalized) &&
    !/\b(?:nosso|nossa|oferecemos|entregamos|garantimos|aprovamos|enviamos|cobramos)\b/.test(normalized);
}
