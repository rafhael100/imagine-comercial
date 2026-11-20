// Narrow lexical guard for the fictional private paid-lab model output.
// A source ID can be genuine while the model invents a written-out fee or a
// free-service offer. Do not treat this as semantic grounding, a billing policy
// or an exhaustive detector; all results still need human editorial review.
const quantity = String.raw`(?:zero|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|duzentas|trezentos|trezentas|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos|mil|milhao|milhoes)`;
const amountsInWords = new RegExp(
  String.raw`\b` + quantity +
  String.raw`(?:\s+(?:e|` + quantity + String.raw`)){0,8}\s+(?:reais|real|dolares?|euros?)\b`,
  'u'
);
const unreviewedFreeOffer =
  /\b(?:site|pagina|landing\s+page|servico|plano|implantacao|hospedagem|mensalidade)\b.{0,40}\b(?:gratis|gratuit[oa]s?|sem\s+custo|sem\s+cobrar|sem\s+mensalidade)\b/u;

/** Fail closed on obvious monetary promises expressed without currency digits. */
export function hasPrivateUnreviewedPriceClaim(value) {
  if (typeof value !== 'string') return true;
  const normalized = value.normalize('NFKC').normalize('NFKD')
    .replace(/\p{M}/gu, '').toLowerCase().replace(/\p{Pd}/gu, ' ');
  return amountsInWords.test(normalized) || unreviewedFreeOffer.test(normalized);
}
