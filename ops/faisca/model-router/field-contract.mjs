import { createSession, respond } from '../core.mjs';
import { getQualificationFieldOptions } from '../qualification/profile.mjs';

export const FIELD_REQUEST_SCHEMA = 'faisca.model-field.request.v1';
export const FIELD_RESPONSE_SCHEMA = 'faisca.model-field.response.v1';
const trustedRequests = new WeakSet();
const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
function localFingerprint(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function plainData(value, expected) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== expected.length || keys.some(key => typeof key !== 'string' || !expected.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value), result = Object.create(null);
    for (const key of expected) {
      if (!Object.hasOwn(descriptors[key], 'value')) return null;
      result[key] = descriptors[key].value;
    }
    return result;
  } catch { return null; }
}

function plainOptions(value) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
        value.length < 2 || value.length > 5 || Reflect.ownKeys(value).length !== value.length + 1) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value), result = [];
    for (let i = 0; i < value.length; i++) {
      const option = plainData(descriptors[i]?.value, ['value', 'label']);
      if (!option || typeof option.value !== 'string' || typeof option.label !== 'string') return null;
      result.push(Object.freeze(option));
    }
    return result;
  } catch { return null; }
}

const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const patterns = Object.freeze({
  objective: Object.freeze({
    present_company: [/\b(?:apresentar|divulgar)\b.*\b(?:empresa|negocio)\b/, /\bsite institucional\b/],
    capture_leads: [/\b(?:captar|gerar|receber)\b.*\b(?:contatos?|leads?)\b/, /\b(?:contatos?|leads?)\b.*\b(?:interessados?|clientes?)\b/],
    sell_online: [/\b(?:vender|vendas|comercializar)\b.*\b(?:online|internet)\b/],
    organize_service: [/\b(?:facilitar|organizar)\b.*\b(?:contato|atendimento)\b/],
    not_specified: [/\b(?:ainda nao sei|nao defini|nao tenho certeza)\b/]
  }),
  audience: Object.freeze({
    local_customers: [/\b(?:clientes?|consumidores?)\b.*\b(?:regiao|cidade|bairro|local)\b/],
    businesses: [/\b(?:outras empresas|empresas|negocios|b2b)\b/],
    online_consumers: [/\b(?:consumidores?|clientes?)\b.*\b(?:online|internet)\b/],
    existing_clients: [/\b(?:clientes atuais|clientes que ja tenho|base de clientes)\b/],
    not_specified: [/\b(?:ainda nao sei|nao defini|prefiro nao informar)\b/]
  }),
  materials: Object.freeze({
    ready: [/\b(?:ja tenho|tenho)\b.*\b(?:textos?|imagens?|materiais?)\b/, /\btextos? e imagens? ja estao prontos\b/],
    need_support: [/\b(?:preciso|necessito)\b.*\b(?:ajuda|apoio)\b/, /\bnao tenho (?:textos?|imagens?|materiais?)\b/],
    not_specified: [/\b(?:ainda nao sei|nao defini|prefiro nao informar)\b/]
  }),
  timeline: Object.freeze({
    within_30_days: [/\b(?:ate|em|nos proximos|proximos)\s*(?:30|trinta)\s*dias?\b/, /\b(?:um mes|1 mes)\b/],
    within_90_days: [/\b(?:ate|em|nos proximos|proximos)\s*(?:90|noventa)\s*dias?\b/, /\b(?:tres meses|3 meses)\b/],
    flexible: [/\b(?:sem prazo|sem pressa|flexivel|quando der|mais pra frente)\b/],
    not_specified: [/\b(?:prefiro nao informar|ainda nao sei|nao defini)\b/]
  }),
  contactConsent: Object.freeze({
    declined: [/\b(?:nao autorizo|nao quero contato|nao quero que entrem em contato|nao pode entrar em contato|prefiro que nao entrem em contato)\b/],
    later: [/\b(?:prefiro decidir depois|mais tarde|depois eu decido|ainda nao sei)\b/],
    granted: [/\bsim[\s,]+autorizo\b/, /\b(?:pode entrar em contato|pode me contatar)\b/]
  })
});

export function prepareFieldRouteRequest(options = {}) {
  const data = plainData(options, ['conversationId', 'messageId', 'userText', 'field']);
  if (!data || ![data.conversationId, data.messageId].every(value =>
    typeof value === 'string' && ID_PATTERN.test(value)) ||
      typeof data.userText !== 'string' || data.userText.length < 1 || data.userText.length > 800 ||
      typeof data.field !== 'string') return null;
  const optionsForField = getQualificationFieldOptions(data.field);
  if (!optionsForField || optionsForField.length < 2 || optionsForField.length > 5) return null;
  const preflight = respond(createSession(), { type: 'text', text: data.userText });
  if (['sensitive_input', 'unsupported_instruction', 'too_long', 'invalid_input', 'invalid_session'].includes(preflight.reply.intent)) return null;
  const request = Object.freeze({
    schema: FIELD_REQUEST_SCHEMA,
    invocationId: localFingerprint([data.conversationId, data.messageId, data.field, data.userText].join(':')),
    conversationId: data.conversationId, messageId: data.messageId,
    locale: 'pt-BR', field: data.field, userText: data.userText,
    allowedOptions: Object.freeze(optionsForField.map(option => Object.freeze({ ...option }))),
    limits: Object.freeze({ maxAnswerCharacters: 800, maxOptions: 5, timeoutMs: 3000 })
  });
  trustedRequests.add(request);
  return request;
}

const responseFields = Object.freeze(['schema', 'invocationId', 'messageId', 'field', 'status', 'value']);
const rejected = Object.freeze({ accepted: false, status: 'refused', value: null, reason: 'field_route_unverified' });

export function verifyFieldRouteResponse(request, candidate) {
  if (!trustedRequests.has(request)) return rejected;
  const data = plainData(candidate, responseFields);
  if (!data || data.schema !== FIELD_RESPONSE_SCHEMA ||
      data.invocationId !== request.invocationId || data.messageId !== request.messageId ||
      data.field !== request.field) return rejected;
  if (data.status === 'matched' && typeof data.value === 'string' &&
      request.allowedOptions.some(option => option.value === data.value)) {
    return Object.freeze({ accepted: true, status: 'matched', field: request.field,
      value: data.value, reason: 'closed_option_match' });
  }
  if (['ambiguous', 'unknown'].includes(data.status) && data.value === null) {
    return Object.freeze({ accepted: true, status: data.status, field: request.field,
      value: null, reason: data.status });
  }
  return rejected;
}

export function localFieldRouteFixture(request) {
  if (!trustedRequests.has(request)) return Object.freeze({ error: 'invalid_request' });
  const text = normalize(request.userText);
  const fieldPatterns = patterns[request.field] ?? {};
  const matches = request.allowedOptions.filter(option =>
    (fieldPatterns[option.value] ?? []).some(pattern => pattern.test(text)));
  return Object.freeze({
    schema: FIELD_RESPONSE_SCHEMA,
    invocationId: request.invocationId,
    messageId: request.messageId,
    field: request.field,
    status: matches.length === 1 ? 'matched' : matches.length > 1 ? 'ambiguous' : 'unknown',
    value: matches.length === 1 ? matches[0].value : null
  });
}

export function routeFieldWithLocalFixture(options = {}) {
  const request = prepareFieldRouteRequest(options);
  if (!request) return Object.freeze({ ...rejected, reason: 'request_refused' });
  return verifyFieldRouteResponse(request, localFieldRouteFixture(request));
}
