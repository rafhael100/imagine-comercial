import {
  getAnonymousRouteBoundary, retrieveCandidateAnswerIds
} from '../model-router/contract.mjs';
import { hasPrivateIdentifierRisk } from './private-identifier-risk.mjs';

export const PRIVATE_SYNTHETIC_QUESTION_SCHEMA = 'faisca.private-operator-synthetic-question.v1';
const trusted = new WeakSet();
const MAX_CHARS = 240;
const MAX_BYTES = 480;
// A conservative gate for laboratory operator-drafted examples. This is NOT
// exhaustive PII redaction, a consent mechanism, or production DLP.
const forbidden = [
  /https?:\/\/|www\.|@|\b(?:[0-9][ .-]?){7,}\b/i,
  /\b(?:cpf|cnpj|rg|passaporte|documentos?|telefone|whatsapp|e-?mail|endere[cç]o|endereco)\b/i,
  /\b(?:dados\s+(?:pessoais|sens[ií]veis)|informa[cç][oõ]es\s+(?:pessoais|sens[ií]veis)|lista\s+de\s+clientes|base\s+de\s+clientes)\b/i,
  /\b(?:senha|token|api[ _-]?key|chave|credencial|codigo\s+de\s+acesso|c[oó]digo\s+de\s+acesso|otp|2fa|totp)\b/i,
  /\b(?:pix|cart[aã]o|fatura|boleto|nota\s+fiscal|pagamento|pedido|contrato|cancelamento|cancelar|reembolso)\b/i,
  /\b(?:meu\s+cliente|minha\s+empresa\s+se\s+chama|meu\s+site\s+est[aá]\s+fora|projeto\s+do\s+cliente)\b/i,
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u
];

function dataOnly(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 3 || !['scope', 'attestedSynthetic', 'question'].every(key => keys.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value'))) return null;
    return {
      scope: descriptors.scope.value,
      attestedSynthetic: descriptors.attestedSynthetic.value,
      question: descriptors.question.value
    };
  } catch { return null; }
}

export function readPrivateSyntheticQuestion(raw) {
  const data = dataOnly(raw);
  if (!data || data.scope !== 'local_operator_lab' || data.attestedSynthetic !== true ||
      typeof data.question !== 'string' ||
      data.question !== data.question.normalize('NFC')) return null;
  const question = data.question.trim();
  if (question !== data.question ||
      [...question].length < 12 || [...question].length > MAX_CHARS ||
      Buffer.byteLength(question, 'utf8') > MAX_BYTES ||
      question.split(/\s+/u).length < 3 ||
      forbidden.some(rule => rule.test(question)) ||
      hasPrivateIdentifierRisk(question)) return null;
  return question;
}

/**
 * Accept ONLY an operator-attested fictional public-services question with
 * reviewed editorial candidates. Do not use this to handle real visitor input
 * or silently send its contents to OpenAI. The LLM transport remains disabled
 * for this type until a separate verified adapter and staging gate exists.
 */
export function preparePrivateSyntheticQuestion(raw) {
  const question = readPrivateSyntheticQuestion(raw);
  if (!question || getAnonymousRouteBoundary(question) !== null) return null;
  const candidateAnswerIds = retrieveCandidateAnswerIds(question);
  if (candidateAnswerIds.length < 1) return null;
  const output = Object.freeze({
    schema: PRIVATE_SYNTHETIC_QUESTION_SCHEMA,
    question,
    candidateAnswerIds: Object.freeze([...candidateAnswerIds]),
    source: 'operator_attested_synthetic_only',
    customerDataAuthorized: false,
    publicEnabled: false,
    operationalEffects: false
  });
  trusted.add(output);
  return output;
}

export function isTrustedPrivateSyntheticQuestion(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function') &&
    trusted.has(value);
}
