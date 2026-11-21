// R180: independent, conservative preflight for the PRIVATE fictional-question
// lab. Operator-authored text is data, never an instruction to Luna/Terra.
// This is NOT a comprehensive prompt-injection detector or a production DLP.
const instructionOverride = [
  /\b(?:ignore|desconsidere|esqueca|esquece|anule|substitua|desative|contorne|bypasse)\b.{0,95}\b(?:instrucoes?|regras?|politicas?|sistema|prompts?|limites?|filtros?|seguranca|restricoes?)\b/u,
  /\b(?:finja|aja|atue|assuma|comporte.se)\b.{0,80}\b(?:como|papel|modo)\b.{0,75}\b(?:sistema|developer|desenvolvedor|administrador|sem restricoes?)\b/u,
  /(?:^|[\s\[({])(?:system|developer|assistant|usuario|user)\s*:\s*\S/u,
  /\b(?:voce|vc)\s+agora\s+(?:e|sera)\s+(?:o|a|um|uma)?\s*(?:sistema|developer|desenvolvedor|administrador)\b/u,
  /\b(?:revele|mostre|imprima|exiba|vaze|liste)\b.{0,95}\b(?:prompt|instrucoes? internas?|segredos?|credenciais?|chaves?|politicas? internas?|mensagem\s+de\s+sistema)\b/u
];

// R182: second pass for deliberately fragmented role headers and override
// commands. This is intentionally DENY-only: no input is rewritten and no
// normalized question is ever forwarded to the model or written to logs.
// A small false-positive cost is preferable to spending credits on adversarial
// fictional inputs. This remains NOT a complete prompt-injection detector.
const explicitRoleDelimiters =
  /(?:\[\s*im_start\s*\]|\[\s*\/?\s*inst\s*\]|<<\s*sys\s*>>|<\s*\/?\s*(?:system|developer|assistant|user)\s*>|["'](?:role|speaker)["']\s*:\s*["'](?:system|developer)["'])/u;
const compactOverride = [
  /(?:ignore|desconsidere|esqueca|esquece|desative|contorne|bypasse)[\\p{L}\\p{N}]{0,110}(?:instrucoes|regras|politicas|sistema|prompts|limites|filtros|seguranca|restricoes)/u,
  /(?:finja|assuma|atue|aja)[\\p{L}\\p{N}]{0,105}(?:papel|como|modo)[\\p{L}\\p{N}]{0,80}(?:sistema|developer|desenvolvedor|administrador)/u,
  /^(?:system|developer|assistant|usuario|user)\s*:\s*\S/u,
  /(?:revele|mostre|imprima|exiba|vaze|liste)[\\p{L}\\p{N}]{0,105}(?:prompt|instrucoesinternas|segredos|credenciais|chaves|politicasinternas|mensagemdesistema)/u
];

export function hasPrivateSyntheticInstructionOverrideRisk(text) {
  if (typeof text !== 'string' || text.length > 1000) return true;
  // No raw text, matched fragments or identifying data are returned/logged.
  const normalized = text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  if (instructionOverride.some(rule => rule.test(normalized)) ||
      explicitRoleDelimiters.test(normalized)) return true;
  // Detect s.y.s.t.e.m:, i.g.n.o.r.e r.e.g.r.a.s and similar punctuation/
  // spacing fragmentation without accepting the canonicalized text as data.
  const compact = normalized.replace(/[\p{White_Space}._\u00b7-]/gu, '');
  return compactOverride.some(rule => rule.test(compact));
}
