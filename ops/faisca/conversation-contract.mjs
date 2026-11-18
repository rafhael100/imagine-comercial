import { KNOWLEDGE } from './knowledge.mjs';
import { getActionCatalog } from './core.mjs';
import { getGroundingSources } from './grounding/catalog.mjs';

// An in-memory laboratory wire contract, not authentication or an HTTP API.
export const CONVERSATION_SCHEMA = 'faisca.conversation.v1';
export const RESPONSE_SCHEMA = 'faisca.response.v1';
const qualificationFields = Object.freeze({
  objective: Object.freeze(['present_company', 'capture_leads', 'sell_online', 'organize_service', 'not_specified']),
  audience: Object.freeze(['local_customers', 'businesses', 'online_consumers', 'existing_clients', 'not_specified']),
  materials: Object.freeze(['ready', 'need_support', 'not_specified']),
  timeline: Object.freeze(['within_30_days', 'within_90_days', 'flexible', 'not_specified']),
  contactConsent: Object.freeze(['granted', 'declined', 'later'])
});
const qualificationActionLabels = Object.freeze({
  objective: Object.freeze({ present_company: 'Apresentar minha empresa', capture_leads: 'Captar contatos interessados',
    sell_online: 'Divulgar produtos ou serviços online', organize_service: 'Facilitar o primeiro contato com clientes',
    not_specified: 'Ainda não defini' }),
  audience: Object.freeze({ local_customers: 'Clientes da minha região', businesses: 'Outras empresas',
    online_consumers: 'Consumidores online', existing_clients: 'Clientes atuais', not_specified: 'Ainda não defini' }),
  materials: Object.freeze({ ready: 'Já tenho os materiais', need_support: 'Preciso de ajuda com o conteúdo',
    not_specified: 'Ainda não sei' }),
  timeline: Object.freeze({ within_30_days: 'Nos próximos 30 dias', within_90_days: 'Nos próximos 90 dias',
    flexible: 'Sem prazo definido', not_specified: 'Prefiro não informar' }),
  contactConsent: Object.freeze({ granted: 'Sim, autorizo', declined: 'Não autorizo', later: 'Prefiro decidir depois' })
});
const qualificationActions = Object.freeze({
  'r08:summary': 'Ver resumo parcial',
  'r08:change_service': 'Trocar solução',
  'r08:restart': 'Reiniciar atendimento',
  'r08:edit:objective': 'Corrigir objetivo',
  'r08:edit:audience': 'Corrigir público',
  'r08:edit:materials': 'Corrigir materiais',
  'r08:edit:timeline': 'Corrigir previsão',
  'r08:edit:contactConsent': 'Corrigir autorização',
  ...Object.fromEntries(Object.entries(qualificationFields).flatMap(([field, values]) =>
    values.map(value => ['r08:' + field + ':' + value, qualificationActionLabels[field][value]])))
});
const actions = Object.freeze({ ...getActionCatalog(),
  confirm_goal: 'Confirmar meu objetivo', cancel_goal: 'Não, quero avaliar outra opção',
  ...qualificationActions });
const sources = new Map([
  ...Object.values(KNOWLEDGE.sources).map(source => [source.id,
    Object.freeze({ id: source.id, title: source.title, version: KNOWLEDGE.version })]),
  ...getGroundingSources().map(source => [source.id, source])
]);
const opaqueId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,96}$/.test(value);
const textLength = (value, max) => typeof value === 'string' && value.length <= max * 2 &&
  [...value].length <= max && value.trim().length > 0;

function record(value, fields) {
  if (!value || typeof value !== 'object') return null;
  try {
    if (Array.isArray(value)) return null;
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result = {};
    for (const key of fields) {
      if (!Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptors[key], 'value')) return null;
      result[key] = descriptors[key].value;
    }
    return result;
  } catch { return null; }
}

function list(value, max, readItem) {
  try {
    if (!Array.isArray(value)) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = descriptors.length?.value;
    if (!Number.isInteger(length) || length < 0 || length > max) return null;
    if (Reflect.ownKeys(value).length !== length + 1) return null;
    const result = [];
    for (let index = 0; index < length; index++) {
      const descriptor = descriptors[index];
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
      const item = readItem(descriptor.value);
      if (!item) return null;
      result.push(Object.freeze(item));
    }
    return Object.freeze(result);
  } catch { return null; }
}

/** Return a detached, frozen request or null without invoking data accessors. */
export function validateConversationRequest(value) {
  const data = record(value, ['schema', 'conversationId', 'messageId', 'locale', 'input']);
  if (!data || data.schema !== CONVERSATION_SCHEMA || data.locale !== 'pt-BR' ||
      !opaqueId(data.conversationId) || !opaqueId(data.messageId)) return null;
  const text = record(data.input, ['type', 'text']);
  const action = text ? null : record(data.input, ['type', 'id']);
  let input;
  if (text?.type === 'text' && textLength(text.text, 800)) input = { type: 'text', text: text.text };
  else if (action?.type === 'action' && typeof action.id === 'string' && Object.hasOwn(actions, action.id)) {
    input = { type: 'action', id: action.id };
  } else return null;
  return Object.freeze({ schema: CONVERSATION_SCHEMA, conversationId: data.conversationId,
    messageId: data.messageId, locale: 'pt-BR', input: Object.freeze(input) });
}

/** A canonical SHA-256 fingerprint includes the whole validated request. */
export async function conversationFingerprint(value) {
  const request = validateConversationRequest(value);
  if (!request) throw new TypeError('Invalid conversation request.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(request)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Source/action titles are never provided by the simulated model. */
export function createConversationResponse(request, reply) {
  return Object.freeze({ schema: RESPONSE_SCHEMA, conversationId: request.conversationId,
    messageId: request.messageId, locale: 'pt-BR', knowledgeVersion: KNOWLEDGE.version,
    text: reply.text,
    sources: Object.freeze(reply.sources.map(source => Object.freeze({ id: source.id, version: sources.get(source.id)?.version }))),
    actions: Object.freeze(reply.actions.map(action => Object.freeze({ id: action.id }))) });
}

/** Correlation, closed schema, versioned sources and interface-only actions. */
export function validateConversationResponse(value, requestValue) {
  const request = validateConversationRequest(requestValue);
  const data = record(value, ['schema', 'conversationId', 'messageId', 'locale', 'knowledgeVersion', 'text', 'sources', 'actions']);
  if (!request || !data || data.schema !== RESPONSE_SCHEMA || data.locale !== request.locale ||
      data.conversationId !== request.conversationId || data.messageId !== request.messageId ||
      data.knowledgeVersion !== KNOWLEDGE.version || !textLength(data.text, 3000) ||
      /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(data.text)) return null;
  const safeSources = list(data.sources, 4, value => {
    const source = record(value, ['id', 'version']);
    return source && typeof source.id === 'string' && sources.has(source.id) &&
      source.version === sources.get(source.id).version ? source : null;
  });
  const safeActions = list(data.actions, 6, value => {
    const action = record(value, ['id']);
    return action && typeof action.id === 'string' && Object.hasOwn(actions, action.id) ? action : null;
  });
  if (!safeSources || !safeActions || new Set(safeSources.map(x => x.id)).size !== safeSources.length ||
      new Set(safeActions.map(x => x.id)).size !== safeActions.length) return null;
  return Object.freeze({ ...data, sources: safeSources, actions: safeActions });
}

export function conversationResponseToReply(response) {
  return Object.freeze({ text: response.text, state: 'TALK', intent: 'simulated_response',
    sources: Object.freeze(response.sources.map(source => Object.freeze({ id: source.id, title: sources.get(source.id).title }))),
    actions: Object.freeze(response.actions.map(action => Object.freeze({ id: action.id, label: actions[action.id] }))) });
}
