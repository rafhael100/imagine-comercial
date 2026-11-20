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

// R148: plain hostnames and network literals are identifiers even without
// a scheme, www. or @. Conservative false positives are safer in a fictional
// operator-only lab than disclosing a real customer's bare domain to Luna/Terra.
// R149: Unicode/IDN labels and non-ASCII dot separators also identify a host.
// Fold U+3002, U+2024 and U+2027 for risk scanning only, never echo input.
// Apply after NFKC/NFKD so compatibility/fullwidth dots cannot bypass checks.
const bareHostname = /(?:^|[^\p{L}\p{N}_@])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:\p{L}{2,24}|xn--[a-z0-9-]{2,59})(?![\p{L}\p{N}_-])/u;
const ipv4Literal = /(?:^|[^\p{L}\p{N}.])(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?![\p{L}\p{N}])/u;
const ipv6Literal = /(?:^|[^\p{L}\p{N}:])(?:[a-f0-9]{0,4}:){2,}[a-f0-9]{0,4}(?=$|[^\p{L}\p{N}:])/u;
const localhostName = /\blocalhost\b/u;

/** Fail closed for obvious identifier/contact leakage; never return the input. */
export function hasPrivateIdentifierRisk(value) {
  if (typeof value !== 'string') return true;
  if (hiddenControls.test(value)) return true;
  const text = value.normalize('NFKC').normalize('NFKD')
    .replace(/\p{M}/gu, '').replace(/[\u3002\u2024\u2027]/gu, '.').toLowerCase();
  return plausibleContactDigits.test(text) ||
    sensitiveWords.test(text) || emailOrUrl.test(text) ||
    bareHostname.test(text) || ipv4Literal.test(text) ||
    ipv6Literal.test(text) || localhostName.test(text);
}
