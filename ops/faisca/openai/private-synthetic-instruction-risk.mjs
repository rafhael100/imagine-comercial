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

export function hasPrivateSyntheticInstructionOverrideRisk(text) {
  if (typeof text !== 'string') return true;
  // No raw text, matched fragments or identifying data are returned/logged.
  const normalized = text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  return instructionOverride.some(rule => rule.test(normalized));
}
