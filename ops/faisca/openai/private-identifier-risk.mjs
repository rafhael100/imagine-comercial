// Conservative preflight and egress protection for the PRIVATE synthetic operator
// lab. This rejects recognizable identifiers before a paid request and in a
// generated response. It is not general-purpose PII detection or LGPD approval.
// Unicode compatibility forms (full-width/mathematical digits, etc.) must not
// evade the ASCII checks used by the older R80/R95 laboratory gate.
const hiddenControls = /[\p{Cc}\p{Cf}]/u;
// Decimal numerals in Arabic, Persian, Devanagari and mixed scripts are not
// converted to ASCII by NFKC. Detect them before either the paid request or
// HTTP egress, including Unicode/Arabic grouping separators.
const plausibleContactDigits = /(?:\p{Nd}[\s\p{Zs}\p{Pd}().+\/,\u066B\u066C\u060C]*){8,}/u;
const sensitiveWords = /\b(?:cpf|cnpj|rg|cep|telefone|celular|whatsapp|e-?mail|pix|senha|token|credencial|otp|totp|2fa|passaporte|chave\s+(?:pix|de\s+api)|conta\s+bancaria|cartao\s+(?:de\s+)?credito|endereco\s+residencial|numero\s+de\s+(?:pedido|contrato|documento))\b/u;
// Any @-handle or email must stay out of this fictional-only experiment;
// internationalized domains need not match an ASCII TLD to be private.
const emailOrUrl = /https?:\/\/|\bwww\.|@|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\barroba\b.{0,35}\bponto\b/u;

/** Fail closed for obvious identifier/contact leakage; never return the input. */
export function hasPrivateIdentifierRisk(value) {
  if (typeof value !== 'string') return true;
  if (hiddenControls.test(value)) return true;
  const text = value.normalize('NFKC').normalize('NFKD')
    .replace(/\p{M}/gu, '').toLowerCase();
  return plausibleContactDigits.test(text) ||
    sensitiveWords.test(text) || emailOrUrl.test(text);
}
