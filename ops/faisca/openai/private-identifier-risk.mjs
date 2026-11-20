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
// R150: WHATWG URL hosts may reinterpret shortened/private IPv4, octal
// and hexadecimal numeric aliases as routable IPs (e.g. 127.1 -> 127.0.0.1).
// Block their conservative lexical forms without resolving any addresses.
const shortenedPrivateIpv4 = /(?:^|[^\p{L}\p{N}.])(?:0|10|127|169|172|192)\.(?:[0-9]{1,3}\.){0,2}[0-9]{1,3}(?![\p{L}\p{N}])/u;
const hexIpv4Alias = /(?:^|[^\p{L}\p{N}_])0x[0-9a-f]{2,8}(?:\.(?:0x)?[0-9a-f]{1,8}){0,3}(?![\p{L}\p{N}_])/u;
const octalIpv4Alias = /(?:^|[^\p{L}\p{N}.])0[0-7]{2,3}(?:\.[0-7]{1,3}){1,3}(?![\p{L}\p{N}])/u;
const ipv6Literal = /(?:^|[^\p{L}\p{N}:])(?:[a-f0-9]{0,4}:){2,}[a-f0-9]{0,4}(?=$|[^\p{L}\p{N}:])/u;
const localhostName = /\blocalhost\b/u;
// R151: recognize credential-shaped values without requiring words like
// 'senha' or 'token'. No value is logged, persisted or echoed.
const secretShape = /(?:^|[^\p{L}\p{N}_])(?:sk-(?:proj-|svcacct-)?[a-z0-9_-]{16,}|github_pat_[a-z0-9_]{16,}|gh[pousr]_[a-z0-9_]{20,}|xox[baprs]-[a-z0-9-]{16,}|akia[a-z0-9]{16}|bearer\s+[a-z0-9._~+/-]{16,}|-----begin\s+(?:(?:rsa|ec|openssh)\s+)?private\s+key-----)/u;

// R152: refuse text-encoded identifier envelopes instead of decoding and
// accidentally passing hidden contact/credential values to a paid model.
// This is deliberately conservative: a fictional lab has no need for
// percent escapes, HTML character references, or JS escape notation.
// Ordinary "20% de aumento" (not percent-encoded bytes) is still allowed.
const encodedIdentifierEnvelope =
  /%(?:[0-9a-f]{2}|u[0-9a-f]{4})|&(?:#(?:x[0-9a-f]{1,7}|[0-9]{1,8})|(?:commat|period|colon|sol|bsol|num|percnt));|\\(?:x[0-9a-f]{2}|u(?:[0-9a-f]{4}|\{[0-9a-f]{1,6}\}))/u;

/** Fail closed for obvious identifier/contact leakage; never return the input. */
export function hasPrivateIdentifierRisk(value) {
  if (typeof value !== 'string') return true;
  if (hiddenControls.test(value)) return true;
  const text = value.normalize('NFKC').normalize('NFKD')
    .replace(/\p{M}/gu, '').replace(/[\u3002\u2024\u2027]/gu, '.').toLowerCase();
  return plausibleContactDigits.test(text) ||
    sensitiveWords.test(text) || emailOrUrl.test(text) ||
    bareHostname.test(text) || ipv4Literal.test(text) ||
    shortenedPrivateIpv4.test(text) || hexIpv4Alias.test(text) ||
    octalIpv4Alias.test(text) || ipv6Literal.test(text) || localhostName.test(text) ||
    secretShape.test(text) || encodedIdentifierEnvelope.test(text);
}
