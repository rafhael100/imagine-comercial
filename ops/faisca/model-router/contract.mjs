import { createHash } from 'node:crypto';
import { createSession, respond } from '../core.mjs';
import { CATALOG } from '../grounding/catalog.mjs';
import { getGroundedAnswer } from '../grounding/guide.mjs';

export const ROUTER_REQUEST_SCHEMA = 'faisca.model-route.request.v1';
export const ROUTER_RESPONSE_SCHEMA = 'faisca.model-route.response.v1';
export const ROUTER_EGRESS_SCHEMA = 'faisca.model-route.candidate-only-egress.v1';
const trustedRequests = new WeakSet();
const trustedEgress = new WeakSet();
const sha = value => createHash('sha256').update(value).digest('hex');
const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const clarificationCopy = Object.freeze({
  service_choice: 'Você procura um site para apresentar sua empresa ou uma página para uma oferta específica?',
  goal_clarification: 'Qual é o principal resultado que você deseja alcançar?',
  audience_clarification: 'Quem você deseja alcançar principalmente?',
  support_unknown: 'Não encontrei uma informação confirmada para responder com segurança. Posso reformular a dúvida ou preparar um resumo para a equipe.'
});
export const ROUTER_CLARIFICATION_IDS = Object.freeze(Object.keys(clarificationCopy));
const clarificationIds = ROUTER_CLARIFICATION_IDS;
export function getFixedRouteClarification(id) {
  return typeof id === 'string' && Object.hasOwn(clarificationCopy, id) ? clarificationCopy[id] : null;
}
const stopWords = new Set(['a', 'as', 'ao', 'aos', 'com', 'da', 'das', 'de', 'do', 'dos',
  'e', 'em', 'essa', 'esse', 'esta', 'este', 'eu', 'me', 'minha', 'meu', 'na', 'nas',
  'no', 'nos', 'o', 'os', 'para', 'por', 'qual', 'quais', 'que', 'se', 'sua', 'seu',
  'um', 'uma', 'voce', 'voces', 'quero', 'preciso', 'gostaria']);
const answerBoosts = Object.freeze({
  goal_presence: Object.freeze(['onepage', 'apresentar minha empresa', 'apresentar a empresa']),
  goal_campaign: Object.freeze(['landing page', 'captar contatos', 'captar leads', 'oferta específica']),
  compare_sites: Object.freeze(['diferença', 'comparar', 'comparação', 'onepage e landing page']),
  channel_google: Object.freeze(['google ads', 'anúncios no google']),
  channel_meta: Object.freeze(['meta ads', 'instagram', 'facebook']),
  pricing: Object.freeze(['quanto custa', 'preço', 'valor', 'investimento']),
  results: Object.freeze(['resultados', 'resultado garantido', 'garantia de vendas']),
  scope: Object.freeze(['escopo', 'revisões', 'alterações', 'o que está incluso']),
  materials_help: Object.freeze(['materiais', 'textos e imagens', 'conteúdo']),
  process: Object.freeze(['como funciona', 'processo', 'etapas', 'passo a passo'])
});
function normalizeText(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
function tokens(value) {
  return normalizeText(value).match(/[a-z0-9]+/g)?.filter(token => token.length > 1 && !stopWords.has(token)) ?? [];
}

/** Deterministic retrieval only; the model can select only these host-approved candidates. */
export function retrieveCandidateAnswerIds(userText, maxCandidates = 5) {
  if (typeof userText !== 'string' || userText.length < 1 || userText.length > 800 ||
      !Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 5) return Object.freeze([]);
  const normalized = normalizeText(userText);
  const queryTokens = new Set(tokens(userText));
  const ranked = CATALOG.answers.map((answer, index) => {
    const passages = answer.passageIds.map(id => CATALOG.passages.find(item => item.id === id));
    const corpus = [answer.id, answer.prefix, answer.suffix, ...passages.map(item => item?.text ?? '')].join(' ');
    const corpusTokens = new Set(tokens(corpus));
    let score = [...queryTokens].reduce((total, token) => total + (corpusTokens.has(token) ? 1 : 0), 0);
    for (const phrase of answerBoosts[answer.id] ?? []) {
      if (normalized.includes(normalizeText(phrase))) score +=
        (answer.id === 'pricing' && phrase === 'quanto custa') ||
        (answer.id === 'process' && phrase === 'como funciona') ? 8 : 4;
    }
    return { id: answer.id, score, index };
  }).filter(item => item.score > 0);
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return Object.freeze(ranked.slice(0, maxCandidates).map(item => item.id));
}
const anonymousBoundaries = Object.freeze({
  support_status: Object.freeze({ routeStatus: 'authentication_required',
    text: 'Para consultar o andamento de um pedido ou projeto, utilize o Portal autenticado ou um canal oficial da Imagine. Esta prévia não consulta informações de clientes.' }),
  support_issue: Object.freeze({ routeStatus: 'authentication_required',
    text: 'O suporte de um serviço real exige confirmação de identidade e canal autorizado. Não envie senhas, dados de clientes nem credenciais nesta prévia.' }),
  support_billing: Object.freeze({ routeStatus: 'authentication_required',
    text: 'Cobranças, pagamentos, notas fiscais e contratos precisam ser verificados em ambiente autenticado. Esta prévia não comprova pagamento nem gera cobranças.' }),
  support_cancel: Object.freeze({ routeStatus: 'authentication_required',
    text: 'Cancelamentos e alterações exigem contrato e canal autorizado. Esta prévia não cancela nem altera qualquer serviço.' }),
  after_sales: Object.freeze({ routeStatus: 'authentication_required',
    text: 'Para acompanhar um serviço contratado, acesse o Portal autenticado ou o canal oficial. Esta prévia apenas ajuda a organizar a dúvida.' }),
  human: Object.freeze({ routeStatus: 'human_handoff',
    text: 'Não há atendente conectado nesta prévia. Você pode preparar um resumo e procurar a equipe pelos canais oficiais confirmados.' }),
  privacy: Object.freeze({ routeStatus: 'privacy_guidance',
    text: 'Não envie senhas, códigos, documentos ou dados de clientes nesta prévia. Consulte a política de privacidade oficial antes de compartilhar informações.' }),
  goal_sales: Object.freeze({ routeStatus: 'product_unverified',
    text: 'Os recursos e a contratação do Imagine CRM precisam ser confirmados pela equipe e pela proposta oficial. Esta prévia não consulta o CRM.' })
});
const blockedIntents = new Set(['sensitive_input', 'unsupported_instruction', 'too_long', 'invalid_input', 'invalid_session',
  ...Object.keys(anonymousBoundaries)]);

/** Host-only fixed reply for an anonymous operational question. Never use model output. */
export function getAnonymousRouteBoundary(userText) {
  if (typeof userText !== 'string' || userText.length < 1 || userText.length > 800) return null;
  const preflight = respond(createSession(), { type: 'text', text: userText });
  const intent = preflight.reply.intent;
  if (!Object.hasOwn(anonymousBoundaries, intent)) return null;
  const boundary = anonymousBoundaries[intent];
  return Object.freeze({
    accepted: true, reason: 'anonymous_operational_boundary',
    routeStatus: boundary.routeStatus, text: boundary.text,
    sources: Object.freeze([]), actions: Object.freeze([]),
    provenance: 'host_fixed_boundary', candidateAnswerIds: Object.freeze([])
  });
}

function plainData(value, expected) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== expected.length || keys.some(key => typeof key !== 'string' || !expected.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result = Object.create(null);
    for (const key of expected) {
      if (!Object.hasOwn(descriptors[key], 'value')) return null;
      result[key] = descriptors[key].value;
    }
    return result;
  } catch { return null; }
}

function plainStrings(value, max) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
        value.length > max || Reflect.ownKeys(value).length !== value.length + 1) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value), result = [];
    for (let i = 0; i < value.length; i++) {
      if (!descriptors[i] || !Object.hasOwn(descriptors[i], 'value') ||
          typeof descriptors[i].value !== 'string' || !ID_PATTERN.test(descriptors[i].value)) return null;
      result.push(descriptors[i].value);
    }
    return result;
  } catch { return null; }
}

function candidatesFor(ids) {
  return Object.freeze(ids.map(id => {
    const answer = getGroundedAnswer(id);
    if (!answer) return null;
    const passages = answer.passageIds.map(passageId => CATALOG.passages.find(item => item.id === passageId));
    if (passages.some(passage => !passage)) return null;
    return Object.freeze({
      answerId: id,
      passageIds: Object.freeze([...answer.passageIds]),
      passages: Object.freeze(passages.map(passage => Object.freeze({
        id: passage.id, digest: passage.digest, text: passage.text, trust: 'UNTRUSTED_DATA'
      })))
    });
  }));
}

/**
 * Trusted host only. The provider receives only a preflight-approved user question and
 * a closed set of public editorial candidates. It cannot supply answer text,
 * URLs, tools, actions, CRM fields or contact data.
 */
export function prepareModelRouteRequest(options = {}) {
  const config = plainData(options, [
    'conversationId', 'messageId', 'userText', 'candidateAnswerIds', 'allowedClarificationIds'
  ]);
  if (!config) return null;
  const { conversationId, messageId, userText } = config;
  const candidateIds = plainStrings(config.candidateAnswerIds, 5);
  const allowedClarifications = plainStrings(config.allowedClarificationIds, 4);
  if (![conversationId, messageId].every(value => typeof value === 'string' && ID_PATTERN.test(value)) ||
      typeof userText !== 'string' || userText.length < 1 || userText.length > 800 ||
      !candidateIds || new Set(candidateIds).size !== candidateIds.length ||
      !allowedClarifications || new Set(allowedClarifications).size !== allowedClarifications.length ||
      allowedClarifications.some(id => !clarificationIds.includes(id))) return null;
  const preflight = respond(createSession(), { type: 'text', text: userText });
  if (blockedIntents.has(preflight.reply.intent)) return null;
  const candidateAnswers = candidatesFor(candidateIds);
  if (candidateAnswers.some(item => !item)) return null;
  const request = Object.freeze({
    schema: ROUTER_REQUEST_SCHEMA,
    invocationId: sha([conversationId, messageId, userText, candidateIds.join(','), CATALOG.version].join(':')),
    conversationId, messageId, locale: 'pt-BR', userText,
    catalogVersion: CATALOG.version,
    candidateAnswers,
    allowedClarificationIds: Object.freeze([...allowedClarifications]),
    limits: Object.freeze({ maxCandidates: 5, maxClarifications: 4, timeoutMs: 3000 })
  });
  trustedRequests.add(request);
  return request;
}

/**
 * R47 privacy-first contract for a future server-owned classifier.
 * Never release the visitor's message, messageId, conversationId, a
 * user-derived invocation digest, contact details or full passages.
 * The host reattaches the original correlation fields AFTER reviewing a
 * classifier's closed candidate selection with verifyModelRouteResponse.
 * No network provider is enabled or configured by this helper.
 */
export function buildCandidateOnlyRouteEgress(request) {
  if (!trustedRequests.has(request)) return null;
  const ids = request.candidateAnswers.map(item => item.answerId);
  if (ids.length < 1 || ids.length > 5) return null;
  const envelope = Object.freeze({
    schema: ROUTER_EGRESS_SCHEMA,
    task: 'select_reviewed_editorial_candidate_only',
    locale: request.locale,
    catalogVersion: request.catalogVersion,
    rankedAnswerIds: Object.freeze([...ids]),
    allowedClarificationIds: Object.freeze([...request.allowedClarificationIds]),
    limits: Object.freeze({ maxSelectedIds: 1, maxOutputChars: 40 }),
    userTextIncluded: false,
    contactIncluded: false,
    conversationIdIncluded: false,
    modelInvoked: false
  });
  trustedEgress.add(envelope);
  return envelope;
}

/** A forged or re-created envelope must never be accepted for serialization. */
export function isTrustedCandidateOnlyEgress(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function') &&
    trustedEgress.has(value);
}

const responseFields = Object.freeze([
  'schema', 'invocationId', 'messageId', 'routeStatus', 'answerId', 'clarificationId'
]);
const rejected = Object.freeze({ accepted: false, reason: 'model_route_unverified' });

/** Only select a host-supplied editorial candidate or a fixed clarification. */
export function verifyModelRouteResponse(request, candidate) {
  if (!trustedRequests.has(request)) return rejected;
  const data = plainData(candidate, responseFields);
  if (!data || data.schema !== ROUTER_RESPONSE_SCHEMA ||
      data.invocationId !== request.invocationId || data.messageId !== request.messageId) return rejected;
  if (data.routeStatus === 'grounded' && typeof data.answerId === 'string' &&
      request.candidateAnswers.some(answer => answer.answerId === data.answerId) &&
      data.clarificationId === null) {
    const answer = getGroundedAnswer(data.answerId);
    if (!answer) return rejected;
    return Object.freeze({
      accepted: true, routeStatus: 'grounded', answerId: answer.id,
      text: answer.text, sources: answer.sources, actions: answer.actions,
      provenance: 'r06_verified_editorial'
    });
  }
  if (data.routeStatus === 'clarify' && data.answerId === null &&
      typeof data.clarificationId === 'string' &&
      request.allowedClarificationIds.includes(data.clarificationId)) {
    return Object.freeze({
      accepted: true, routeStatus: 'clarify', answerId: null,
      text: clarificationCopy[data.clarificationId], sources: Object.freeze([]),
      actions: Object.freeze([]), provenance: 'host_fixed_clarification'
    });
  }
  if (data.routeStatus === 'unsupported' && data.answerId === null && data.clarificationId === null) {
    return Object.freeze({
      accepted: true, routeStatus: 'unsupported', answerId: null,
      text: clarificationCopy.support_unknown, sources: Object.freeze([]),
      actions: Object.freeze([]), provenance: 'host_fixed_fallback'
    });
  }
  return rejected;
}

/** Run host -> guarded retrieval -> fixture -> verifier with zero external model calls. */
export function routeWithLocalFixture(rawOptions = {}) {
  const config = plainData(rawOptions, ['conversationId', 'messageId', 'userText']) ||
    plainData(rawOptions, ['conversationId', 'messageId', 'userText', 'scenario']);
  const refused = Object.freeze({
    accepted: false, reason: 'request_refused', routeStatus: 'refused',
    text: 'Não foi possível encaminhar essa mensagem para a demonstração. Não envie dados pessoais ou de acesso.',
    sources: Object.freeze([]), actions: Object.freeze([]),
    candidateAnswerIds: Object.freeze([])
  });
  if (!config || typeof config.userText !== 'string') return refused;
  const { conversationId, messageId, userText } = config;
  const scenario = config.scenario ?? 'success';
  // An anonymous visitor cannot authorize private Portal/CRM operations merely
  // by phrasing them as a natural-language question. Return fixed host copy.
  const boundary = getAnonymousRouteBoundary(userText);
  if (boundary && [conversationId, messageId].every(value =>
    typeof value === 'string' && ID_PATTERN.test(value))) return boundary;
  const candidateAnswerIds = retrieveCandidateAnswerIds(userText);
  const request = prepareModelRouteRequest({
    conversationId, messageId, userText, candidateAnswerIds,
    allowedClarificationIds: clarificationIds
  });
  if (!request) return refused;
  const raw = localModelRouteFixture(request, scenario);
  const verified = verifyModelRouteResponse(request, raw);
  return Object.freeze({ ...verified, candidateAnswerIds });
}

/** Synthetic fixture only. No API call, network, model credential or external cost. */
export function localModelRouteFixture(request, scenario = 'success') {
  if (!trustedRequests.has(request)) return Object.freeze({ error: 'invalid_request' });
  const first = request.candidateAnswers[0]?.answerId ?? null;
  const candidate = {
    schema: ROUTER_RESPONSE_SCHEMA,
    invocationId: request.invocationId,
    messageId: request.messageId,
    routeStatus: first ? 'grounded' : 'unsupported',
    answerId: first,
    clarificationId: null
  };
  if (scenario === 'clarify') {
    candidate.routeStatus = 'clarify'; candidate.answerId = null;
    candidate.clarificationId = request.allowedClarificationIds[0] ?? null;
  } else if (scenario === 'unsupported') {
    candidate.routeStatus = 'unsupported'; candidate.answerId = null;
  } else if (scenario === 'wrong_topic') {
    candidate.answerId = 'unapproved_answer';
  } else if (scenario === 'stale_invocation') {
    candidate.invocationId = 'stale_invocation';
  } else if (scenario === 'invented_text') {
    candidate.answerText = 'Preço garantido de R$ 99.';
  } else if (scenario === 'tool_request') {
    candidate.tool = 'crm.write';
  } else if (scenario !== 'success') return Object.freeze({ error: 'fixture_unavailable' });
  return Object.freeze(candidate);
}
