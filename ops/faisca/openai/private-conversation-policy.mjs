import { createSession, respond } from '../core.mjs';
import { getGroundedAnswer } from '../grounding/guide.mjs';
import { hasPrivateIdentifierRisk } from './private-identifier-risk.mjs';
import { hasPrivateSyntheticInstructionOverrideRisk } from './private-synthetic-instruction-risk.mjs';

const normalize = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const money = /r\$|[$€£]|\b(?:precos?|valores?|cust[ao]s?|cobra[mn]?|cobram|cobranca|orcamentos?|cotacao|investimento|descontos?|pagamentos?|parcelas?|mensalidades?|reais|brl|usd|pagar|comercializa|gratuit[oa]s?|bonificacoes?)\b/;
const businessFlow = /\b(?:processo|fluxo|etapas?|aprov\w*|revis\w*|entrega\w*|prazo\w*|implantacao|cria\w*|produ\w*|contrat\w*|suporte|escopo|procedimento|envi\w*)\b/;
const company = /\b(?:imagine|voces?|equipe|intern[oa]s?|cliente)\b/;
// R244: operator identity/capabilities are never inferred from Luna/Terra.
// Pricing and broad process requests continue to use the pinned editorial recipe.
// R246: indirect references to the operator/team/bot are company-specific too.
// Without these terms a general-topic classifier could invent availability or
// institutional capabilities without ever writing "Imagine" or "Faisca".
// Prefer deterministic confirmation to a model-authored company assertion.
const namedOperator = /\b(?:imagine|faisca|voces?|(?:a|essa|esta|sua|nossa)\s+(?:equipe|agencia|empresa)|(?:o|este|esse|seu|nosso)\s+(?:assistente|chatbot|bot))\b/;
const broadProcess = /\b(?:como funciona|quais sao as etapas|quais as etapas|qual e o processo)\b/;
const otherFlowDetails = /\b(?:layout|link|portal|prazo|aprov\w*|envi\w*|revis\w*|suporte|entrega\w*)\b/;
const rejectInput = new Set(['sensitive_input', 'unsupported_instruction', 'invalid_input', 'too_long']);
const blockedTopics = new Set(['support_status', 'support_issue', 'support_billing',
  'support_cancel', 'after_sales', 'human', 'privacy', 'goal_sales']);
// Single host-owned confirmation receipt; never model-generated or operator-supplied.
export const PRIVATE_CONVERSATION_CONFIRMATION_TEXT =
  'Essa informação precisa ser confirmada com a equipe da Imagine.';

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
  // An otherwise generic question about the Imagine/Faísca team must not
  // become a model-generated assertion of services, hours or availability.
  if (namedOperator.test(text)) return 'confirm';
  return 'classify';
}

export function privateConversationEditorialReply(route) {
  const approved = ['pricing', 'process'].includes(route) ? getGroundedAnswer(route) : null;
  return {
    status: approved ? 'editorial_answer' : 'needs_confirmation',
    text: approved?.text ?? PRIVATE_CONVERSATION_CONFIRMATION_TEXT,
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
const unsupportedOutcomeGuarantee = /\b(?:garante|garantem|garantimos|garantira|garantirao|garantid[oa]s?|assegura|asseguram|asseguramos|promete|prometem|prometemos|prometera|prometerao)\b.{0,75}\b(?:vendas?|clientes?|leads?|conversoes?|resultados?|ranqueamento|posicoes?|primeira\s+pagina|primeir[oa]\s+(?:posicao|lugar)|trafego)\b|\b(?:vendas?|clientes?|leads?|conversoes?|resultados?|ranqueamento|posicoes?|primeira\s+pagina|primeir[oa]\s+(?:posicao|lugar)|trafego)\b.{0,55}\bgarantid[oa]s?\b/;

// A deterministic quantified sales claim is also unsupported, even without
// saying "garante". This private lab has no customer metrics or predictive
// authority; e.g. "vai gerar 100 leads" must never appear as a verified fact.
const unsupportedQuantifiedOutcome = /\b(?:vai|vamos|ira|irao|iremos|conseguira|conseguiremos)\s+(?:gerar|conseguir|atrair|trazer|obter|entregar|conquistar)\s+(?:ao\s+menos\s+|mais\s+de\s+|no\s+minimo\s+)?\d{1,6}\s+(?:nov[oa]s?\s+)?(?:vendas?|clientes?|leads?|conversoes?)\b|\b(?:tera|terao|teremos)\s+(?:ao\s+menos\s+|mais\s+de\s+|no\s+minimo\s+)?\d{1,6}\s+(?:nov[oa]s?\s+)?(?:vendas?|clientes?|leads?|conversoes?)\b/;

// R147: a live model has no source-of-truth for third-party studies,
// performance percentages or a visitor's search placement. Do not let a
// plausible citation ("according to Google") impersonate evidence: this
// private lab has no approved source for those factual claims.
// R156: an unsupported "study/report" or a platform presented as an
// asserting witness is no more reliable than "according to Google". The
// private provider has no trusted evidence feed for these statements.
const unsupportedExternalAttribution =
  /\b(?:segundo|conforme|de\s+acordo\s+com|dados\s+(?:do|da|de)|(?:pesquisa|estudo|relatorio|levantamento)\s+(?:do|da|de))\s+(?:o\s+|a\s+)?(?:google|meta|sebrae|ibge|openai)\b|\b(?:o\s+|a\s+)?(?:google|meta|sebrae|ibge|openai)\s+(?:afirma|afirmou|confirma|confirmou|comprova|comprovou|recomenda|recomendou)\b/u;
const unsupportedUnverifiedKpi =
  /\b(?:taxa\s+de\s+(?:conversao|cliques?|abertura)|roi|ctr|crescimento|engajamento)\b.{0,45}\d{1,3}(?:[.,]\d{1,2})?\s*%/u;
const unsupportedSearchPlacement =
  /\b(?:seu|sua)\s+(?:site|pagina|landing\s+page|loja)\b.{0,65}\b(?:topo\s+do\s+google|primeir[oa]\s+(?:posicao|pagina|lugar)|top\s*[1-9]\d?)\b/u;

// R201: free-form private model replies have no verifiable analytics or
// research corpus. Even plausible unsourced percentages, absolute performance
// counts and unnamed "studies show" statements must not be presented as facts.
// The fixed editorial recipes do NOT depend on this generated-prose shortcut.
const unsupportedUnattributedStatistics =
  /\b\d{1,3}(?:[.,]\d{1,2})?\s*(?:%|por\s+cento\b)|\b\d{1,6}\s+(?:nov[oa]s?\s+)?(?:vendas?|clientes?|leads?|conversoes?|inscricoes?|visitas?|acessos?)\b/u;
const unsupportedUnnamedResearch =
  /\b(?:pesquisas?|estudos?|relatorios?|levantamentos?|estatisticas?|especialistas?)\s+(?:(?:recentes?|independentes?)\s+)?(?:mostram?|indicam?|revelam?|apontam?|comprovam?|confirmam?)\b|\b(?:segundo|conforme|de\s+acordo\s+com)\s+(?:pesquisas?|estudos?|especialistas?|relatorios?|levantamentos?)\b/u;

// R202: numeric metrics in ordinary words and "N in every M" ratios are
// also invented statistics when free-form answers have no evidence corpus.
// Keep this scoped to percentages, measurable business results and ratios;
// general descriptions such as "uma landing page" remain permitted.
const unsourcedQuantityWord = String.raw`(?:zero|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|mil)`;
const unsourcedQuantitySequence =
  String.raw`${unsourcedQuantityWord}(?:\s+(?:e\s+)?${unsourcedQuantityWord}){0,6}`;
const unsupportedWrittenOutStatistics = new RegExp(
  String.raw`\b(?:${unsourcedQuantitySequence}\s+por\s+cento|${unsourcedQuantitySequence}\s+(?:nov[oa]s?\s+)?(?:vendas?|clientes?|leads?|conversoes?|inscricoes?|visitas?|acessos?)|(?:${unsourcedQuantitySequence}|\d{1,3})\s+(?:em|de)\s+cada\s+(?:${unsourcedQuantitySequence}|\d{1,3}))\b`,
  'u'
);
// R203: the paid, private assistant cannot perform future operational actions.
// A first-person commitment or a passive promise about a visitor asset must
// never be presented as an authorized workflow or confirmed delivery.
const promisedOperationalAction =
  /\b(?:eu\s+)?(?:vou|vamos|irei|iremos)\s+(?:publicar|configurar|ativar|enviar|agendar|cadastrar|integrar|instalar|criar|aprovar|contratar|finalizar|liberar|lancar|hospedar|disponibilizar|colocar\s+no\s+ar|abrir\s+(?:um\s+)?(?:ticket|chamado)|gerar\s+(?:um\s+)?(?:pedido|lead|cobranca))\b/u;
const promisedVisitorAsset =
  /\b(?:seu|sua|seus|suas)\s+(?:site|pagina|landing\s+page|dominio|campanha|formulario|conta|acesso|pedido|projeto)\b.{0,70}\b(?:sera|serao|vai\s+ser|vao\s+ser)\s+(?:publicad[oa]s?|ativad[oa]s?|configurad[oa]s?|enviad[oa]s?|cadastrad[oa]s?|contratad[oa]s?|concluid[oa]s?|aprovad[oa]s?|liberad[oa]s?|integrad[oa]s?|hospedad[oa]s?|disponibilizad[oa]s?|colocad[oa]s?\s+no\s+ar)\b/u;

// R212: claiming the *ability* to perform an action is as misleading as a
// promise of execution. This model has no tools, grants or operational access.
// Scope this to first-person agency, leaving neutral self-service guidance
// ("você pode publicar...") available in fictional answers.
const claimedOperationalCapability =
  /\b(?:(?:eu\s+)?(?:posso|podemos|consigo|conseguimos|conseguirei|conseguiremos|sou\s+capaz\s+de|somos\s+capazes\s+de|estou\s+pronto\s+para|estamos\s+prontos\s+para)\s+(?:publicar|ativar|configurar|cadastrar|integrar|instalar|criar|aprovar|contratar|finalizar|liberar|hospedar|disponibilizar|enviar|agendar|colocar\s+no\s+ar|abrir\s+(?:um\s+)?(?:ticket|chamado)|gerar\s+(?:um\s+)?(?:pedido|lead|cobranca))|(?:publicarei|publicaremos|ativarei|ativaremos|configurarei|configuraremos|cadastrarei|cadastraremos|integrarei|integraremos|instalarei|instalaremos|hospedarei|hospedaremos|liberarei|liberaremos|enviarei|enviaremos|agendarei|agendaremos|criarei|criaremos))\b/u;

export function hasPrivateUnsupportedOutcomeGuarantee(text) {
  if (typeof text !== 'string') return true;
  const normalized = normalize(text);
  return unsupportedOutcomeGuarantee.test(normalized) ||
    unsupportedQuantifiedOutcome.test(normalized) ||
    unsupportedExternalAttribution.test(normalized) ||
    unsupportedUnverifiedKpi.test(normalized) ||
    unsupportedSearchPlacement.test(normalized) ||
    unsupportedUnattributedStatistics.test(normalized) ||
    unsupportedUnnamedResearch.test(normalized) ||
    unsupportedWrittenOutStatistics.test(normalized);
}

export function hasPrivateOperationalClaim(text) {
  if (typeof text !== 'string') return true;
  const normalized = normalize(text);
  return reportedAction.test(normalized) ||
    completedVisitorAsset.test(normalized) ||
    completedVisitorReceipt.test(normalized) ||
    promisedOperationalAction.test(normalized) ||
    promisedVisitorAsset.test(normalized) ||
    claimedOperationalCapability.test(normalized);
}

export function safePrivateGeneralReply(text) {
  if (typeof text !== 'string') return false;
  const normalized = normalize(text);
  return !hasPrivateIdentifierRisk(text) && !hasPrivateOperationalClaim(text) &&
    !hasPrivateSyntheticInstructionOverrideRisk(text) &&
    !hasPrivateUnsupportedOutcomeGuarantee(text) && !money.test(normalized) && !namedOperator.test(normalized) &&
    !/\b(?:nosso|nossa|oferecemos|entregamos|garantimos|aprovamos|enviamos|cobramos)\b/.test(normalized);
}
