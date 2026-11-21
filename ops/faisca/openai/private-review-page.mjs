import { getGroundingSources } from '../grounding/catalog.mjs';
import { getGroundedAnswer } from '../grounding/guide.mjs';
import { PRIVATE_CONVERSATION_CONFIRMATION_TEXT } from './private-conversation-policy.mjs';

// Pin browser-only editorial source IDs to the same checked-in R06 catalog
// used by the independent HTTP egress. Never accept plausible invented IDs.
const REVIEWED_PRIVATE_SOURCE_IDS = Object.freeze(getGroundingSources().map(({ id }) => id));
// A free-text editorial answer has only two valid host-pinned receipts:
// exact reviewed prose AND exact ordered citations. A syntactically valid
// catalog ID alone cannot authorize an invented editorial response.
const REVIEWED_PRIVATE_EDITORIAL_RECEIPTS = Object.freeze(
  ['pricing', 'process'].map(id => getGroundedAnswer(id)).filter(Boolean)
    .map(reply => Object.freeze({
      text: reply.text, sources: reply.sources.map(source => source.id)
    }))
);

// Browser presentation of fixed cases and optional operator-attested fictional questions.
// The browser receives no OpenAI API key; the operator supplies a separate
// temporary review bearer token only in memory, never in storage or URLs.
export const PRIVATE_REVIEW_PAGE_PATH = '/__faisca_openai_private/review';
export const PRIVATE_REVIEW_SCRIPT_PATH = '/__faisca_openai_private/review.js';
export const PRIVATE_REVIEW_STYLE_PATH = '/__faisca_openai_private/review.css';
export const PRIVATE_REVIEW_MASCOT_PATH = '/__faisca_openai_private/mascot.png';

const conversationSlot = '<!-- private-conversation -->';
const conversationFields = String.raw`<fieldset id="review-conversation">
<legend>Pergunta livre</legend>
<label for="review-question">Escreva sua pergunta para o Faísca</label>
<textarea id="review-question" rows="3" minlength="12" maxlength="240"></textarea>
<label class="help"><input id="review-attestation" type="checkbox">
Confirmo que a pergunta é fictícia e não contém dados reais.</label>
<p class="help">Deixe o campo vazio para usar um cenário abaixo.</p>
</fieldset>`;

export const PRIVATE_REVIEW_HTML = String.raw`<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="referrer" content="no-referrer">
<title>Faísca — revisão privada da IA Imagine</title>
<link rel="stylesheet" href="/__faisca_openai_private/review.css">
<script type="module" src="/__faisca_openai_private/review.js"></script>
</head><body>
<main>
<header><img src="/__faisca_openai_private/mascot.png" class="mascot"
width="88" height="88" alt="Faísca, mascote aprovado da Imagine">
<p class="eyebrow">IMAGINE · LABORATÓRIO PRIVADO</p>
<h1>Faísca <span aria-hidden="true">✦</span></h1>
<p>Teste de respostas reais da OpenAI com perguntas <strong>fictícias e aprovadas</strong>.
Esta página é local, protegida por SSH e não atende clientes.</p></header>
<section aria-labelledby="test-title">
<h2 id="test-title">Preparar uma resposta</h2>
<form id="faisca-review-form" autocomplete="off">
<label for="review-token">Token de revisão privada — não é a chave da OpenAI</label>
<input id="review-token" type="password" spellcheck="false" autocomplete="off" minlength="32" maxlength="128" required>
<p class="help">Use o token exclusivo definido no servidor como FAISCA_REVIEW_BEARER_TOKEN.
Nunca cole sua OPENAI_API_KEY aqui.</p>
${conversationSlot}
<label for="review-case">Pergunta fictícia do menu</label>
<select id="review-case" required>
<option value="compare">Qual a diferença entre Onepage e Landing Page?</option>
<option value="process">Como funciona a produção de um site Onepage?</option>
<option value="pricing">Quanto custa um site Onepage?</option>
</select>
<button type="submit" id="review-send">Gerar resposta pela IA</button>
</form>
<p id="review-status" role="status" aria-live="polite">Pronto para um teste privado.</p>
</section>
<section aria-labelledby="answer-title" class="answer">
<h2 id="answer-title">Resposta do Faísca</h2>
<p id="review-answer">A resposta validada aparecerá aqui após uma chamada real.</p>
<p class="help" id="review-sources"></p>
</section>
<footer>Rascunho editorial · Sem dados pessoais, propostas, pedidos, pagamentos ou publicação.
A execução privada pode consumir créditos da API.</footer>
</main>
</body></html>`;

export const PRIVATE_REVIEW_CONVERSATION_HTML =
  PRIVATE_REVIEW_HTML.replace(conversationSlot, conversationFields);

export const PRIVATE_REVIEW_CSS = String.raw`:root{color-scheme:light;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8faf8;color:#25312c}
*{box-sizing:border-box}body{margin:0}main{max-width:740px;padding:1.2rem;margin:1.4rem auto}
header{padding:1.1rem 0}.mascot{display:block;width:88px;height:88px;object-fit:contain}header h1{font-size:2.35rem;letter-spacing:-.06em;margin:.3rem 0}
header h1 span{color:#f9941d}.eyebrow{color:#865513;letter-spacing:.16em;font-size:.8rem;font-weight:800}
section{border:1px solid #cad5cd;border-radius:15px;padding:1.35rem;margin:1.1rem 0;background:#fff}
section h2{font-size:1.1rem;margin:0 0 1rem}
form{display:grid;gap:.7rem}label{font-weight:700}
input,select,textarea,button{font:inherit;min-height:44px;border-radius:8px;padding:.65rem .8rem}
input:not([type=checkbox]),select,textarea{border:1px solid #738679;width:100%;background:#fff;color:#25312c}
fieldset{border:1px solid #cad5cd;border-radius:8px;min-width:0;margin:.4rem 0}
fieldset textarea{display:block;margin:.45rem 0}
fieldset input[type=checkbox]{min-height:auto}
button{border:0;background:#25312c;color:#fff;font-weight:700;cursor:pointer;margin-top:.4rem}
button:disabled{opacity:.65;cursor:default}
:focus-visible{outline:3px solid #c76e00;outline-offset:3px}
.help,footer{font-size:.87rem;color:#4d5d55}
#review-status{min-height:2.5rem;font-weight:600}
#review-answer{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65}
footer{padding:.8rem 0;line-height:1.5}
@media(max-width:420px){main{padding:.75rem;margin:.5rem auto}section{padding:1rem}}
`;

export const PRIVATE_REVIEW_JS = String.raw`const form = document.getElementById('faisca-review-form');
const token = document.getElementById('review-token');
const scenario = document.getElementById('review-case');
const conversation = document.getElementById('review-conversation');
const question = document.getElementById('review-question');
const attestation = document.getElementById('review-attestation');
const send = document.getElementById('review-send');
const status = document.getElementById('review-status');
const answer = document.getElementById('review-answer');
const sources = document.getElementById('review-sources');
const validCases = new Set(['compare','process','pricing']);
const reviewedPrivateSourceIds = new Set(${JSON.stringify(REVIEWED_PRIVATE_SOURCE_IDS)});
const reviewedPrivateEditorialReceipts = ${JSON.stringify(REVIEWED_PRIVATE_EDITORIAL_RECEIPTS)};
const reviewedPrivateConfirmationText = ${JSON.stringify(PRIVATE_CONVERSATION_CONFIRMATION_TEXT)};
function privateBrowserInstructionOverrideRisk(text) {
  const compact = text.replace(/[\s._·-]/gu, '');
  return /(?:\[im_start\]|\[\/?inst\]|<<sys>>|<\s*\/?\s*(?:system|developer)\s*>|["'](?:role|speaker)["']\s*:\s*["'](?:system|developer)["'])/u.test(text) ||
    /(?:ignore|desconsidere|esqueca|esquece|desative|contorne|bypasse)[\p{L}\p{N}]{0,110}(?:instrucoes|regras|politicas|sistema|prompts|filtros|seguranca|restricoes)/u.test(compact) ||
    /(?:finja|assuma|aja|atue)[\p{L}\p{N}]{0,100}(?:papel|como|modo)[\p{L}\p{N}]{0,80}(?:sistema|developer|desenvolvedor|administrador)/u.test(compact) ||
    /^(?:system|developer|assistant|user|usuario):\S/u.test(compact) ||
    /voceagora(?:e|sera)(?:o|a|um|uma)?(?:sistema|developer|desenvolvedor|administrador)/u.test(compact) ||
    /(?:revele|imprima|mostre|exiba)[\p{L}\p{N}]{0,100}(?:prompt|instrucoesinternas|segredos|credenciais|mensagemdesistema)/u.test(compact);
}
function privateFictionalQuestionPreflight(value) {
  if (typeof value !== 'string' || value !== value.trim() ||
      value !== value.normalize('NFC')) return false;
  const normalized = value.normalize('NFKC').normalize('NFKD')
    .replace(/\p{M}/gu, '').replace(/[\u3002\u2024\u2027]/gu, '.').toLowerCase();
  return !(
    /(?!\p{Script=Latin})\p{L}/u.test(value) ||
    /\p{Default_Ignorable_Code_Point}/u.test(value) ||
    /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(value) ||
    /https?:\/\/|www\.|@/u.test(normalized) ||
    privateBrowserEncodedIdentifierRisk.test(normalized) ||
    privateBrowserOpaqueEncodingRisk.test(normalized) ||
    privateBrowserNetworkAddressRisk(normalized) ||
    privateBrowserSecretRisk.test(normalized) ||
    privateBrowserInstructionOverrideRisk(normalized) ||
    /\b(?:cpf|cnpj|rg|passaporte|documentos?|telefone|whatsapp|e-?mail|endereco|senha|token|api[ _-]?key|chave|credencial|otp|totp|pix|cartao|boleto|fatura|reembolso|contrato|nota\s+fiscal)\b/u.test(normalized) ||
    /(?:\p{Nd}[\s\p{Zs}\p{Pd}().+\/,\u066B\u066C\u060C]*){7,}/u.test(normalized) ||
    /\barroba\b.{0,35}\bponto\b/u.test(normalized) ||
    /\b(?:meu\s+cliente|minha\s+empresa\s+se\s+chama|base\s+de\s+clientes|lista\s+de\s+clientes)\b/u.test(normalized)
  );
}
const privateBrowserUnsupportedGuarantee = /\b(?:garante|garantem|garantimos|garantira|garantirao|garantid[oa]s?|assegura|asseguram|asseguramos|promete|prometem|prometemos|prometera|prometerao)\b.{0,75}\b(?:vendas?|clientes?|leads?|conversoes?|resultados?|ranqueamento|posicoes?|primeira\s+pagina|primeir[oa]\s+(?:posicao|lugar)|trafego)\b|\b(?:vendas?|clientes?|leads?|conversoes?|resultados?|ranqueamento|posicoes?|primeira\s+pagina|primeir[oa]\s+(?:posicao|lugar)|trafego)\b.{0,55}\bgarantid[oa]s?\b/;
const privateBrowserUnsupportedProjection = /\b(?:vai|vamos|ira|irao|iremos|conseguira|conseguiremos)\s+(?:gerar|conseguir|atrair|trazer|obter|entregar|conquistar)\s+(?:ao\s+menos\s+|mais\s+de\s+|no\s+minimo\s+)?\d{1,6}\s+(?:nov[oa]s?\s+)?(?:vendas?|clientes?|leads?|conversoes?)\b|\b(?:tera|terao|teremos)\s+(?:ao\s+menos\s+|mais\s+de\s+|no\s+minimo\s+)?\d{1,6}\s+(?:nov[oa]s?\s+)?(?:vendas?|clientes?|leads?|conversoes?)\b/;
const privateBrowserUnsupportedAuthority =
  /\b(?:segundo|conforme|de\s+acordo\s+com|dados\s+(?:do|da|de)|(?:pesquisa|estudo|relatorio|levantamento)\s+(?:do|da|de))\s+(?:o\s+|a\s+)?(?:google|meta|sebrae|ibge|openai)\b|\b(?:o\s+|a\s+)?(?:google|meta|sebrae|ibge|openai)\s+(?:afirma|afirmou|confirma|confirmou|comprova|comprovou|recomenda|recomendou)\b/u;
const privateBrowserUnsupportedKpi =
  /\b(?:taxa\s+de\s+(?:conversao|cliques?|abertura)|roi|ctr|crescimento|engajamento)\b.{0,45}\d{1,3}(?:[.,]\d{1,2})?\s*%/u;
const privateBrowserUnsupportedRank =
  /\b(?:seu|sua)\s+(?:site|pagina|landing\s+page|loja)\b.{0,65}\b(?:topo\s+do\s+google|primeir[oa]\s+(?:posicao|pagina|lugar)|top\s*[1-9]\d?)\b/u;
// Match envelopes rather than decoding potentially sensitive source text.
const privateBrowserEncodedIdentifierRisk =
  /%(?:[0-9a-f]{2}|u[0-9a-f]{4})|&(?:#(?:x[0-9a-f]{1,7}|[0-9]{1,8})|(?:commat|period|colon|sol|bsol|num|percnt));|\\(?:x[0-9a-f]{2}|u(?:[0-9a-f]{4}|\{[0-9a-f]{1,6}\}))/u;
// R153: independent browser denial of opaque base64-like blocks and
// quoted-printable escapes before POST and before rendering HTTP 200.
const privateBrowserOpaqueEncodingRisk =
  /(?:^|[^\\p{L}\\p{N}_])[a-z0-9+/_-]{28,}={0,2}(?![\\p{L}\\p{N}_])|=[0-9a-f]{2}/u;
const privateBrowserSecretRisk = /(?:^|[^\p{L}\p{N}_])(?:sk-(?:proj-|svcacct-)?[a-z0-9_-]{16,}|github_pat_[a-z0-9_]{16,}|gh[pousr]_[a-z0-9_]{20,}|xox[baprs]-[a-z0-9-]{16,}|akia[a-z0-9]{16}|bearer\s+[a-z0-9._~+/-]{16,}|-----begin\s+(?:(?:rsa|ec|openssh)\s+)?private\s+key-----)/u;
const privateBrowserBareHost = /(?:^|[^\p{L}\p{N}_@])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:\p{L}{2,24}|xn--[a-z0-9-]{2,59})(?![\p{L}\p{N}_-])/u;
const privateBrowserIpv4 = /(?:^|[^\p{L}\p{N}.])(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?![\p{L}\p{N}])/u;
// R150: independent browser-only guard for shortened/private IPv4 and numeric
// octal/hexadecimal aliases that a URL parser maps to routable IP literals.
const privateBrowserShortIpv4 = /(?:^|[^\p{L}\p{N}.])(?:0|10|127|169|172|192)\.(?:[0-9]{1,3}\.){0,2}[0-9]{1,3}(?![\p{L}\p{N}])/u;
const privateBrowserHexIpv4 = /(?:^|[^\p{L}\p{N}_])0x[0-9a-f]{2,8}(?:\.(?:0x)?[0-9a-f]{1,8}){0,3}(?![\p{L}\p{N}_])/u;
const privateBrowserOctalIpv4 = /(?:^|[^\p{L}\p{N}.])0[0-7]{2,3}(?:\.[0-7]{1,3}){1,3}(?![\p{L}\p{N}])/u;
const privateBrowserIpv6 = /(?:^|[^\p{L}\p{N}:])(?:[a-f0-9]{0,4}:){2,}[a-f0-9]{0,4}(?=$|[^\p{L}\p{N}:])/u;
function privateBrowserNetworkAddressRisk(text) {
  return privateBrowserBareHost.test(text) || privateBrowserIpv4.test(text) ||
    privateBrowserShortIpv4.test(text) || privateBrowserHexIpv4.test(text) ||
    privateBrowserOctalIpv4.test(text) || privateBrowserIpv6.test(text) ||
    /\blocalhost\b/u.test(text);
}
function privateBrowserReplyEgressSafe(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.normalize('NFKC').normalize('NFKD')
    .replace(/\p{M}/gu, '').replace(/[\u3002\u2024\u2027]/gu, '.').toLowerCase();
  return !(
    // Prevent invisible format characters from concealing an unreviewed claim.
    /\p{Default_Ignorable_Code_Point}/u.test(value) ||
    // R146: a synthetic HTTP 200 from a misconfigured adapter cannot display
    // a fabricated non-BRL fee in the browser's independent final boundary.
    /\p{Sc}/u.test(normalized) ||
    /(?:\b(?:usd|brl|eur)\s*\p{Nd}{1,8}\b|\p{Nd}{1,8}(?:[.,]\p{Nd}{1,2})?\s*(?:reais|real|dolares?|euros?)\b)/u.test(normalized) ||
    /\b(?:preco|valor|custa|custara|cobram|cobramos|mensalidade|implantacao|orcamento|desconto|investimento)\b.{0,28}\p{Nd}{1,8}/u.test(normalized) ||
    /https?:\/\/|\bwww\.|@[a-z0-9.-]+\.[a-z]{2,}/u.test(normalized) ||
    privateBrowserEncodedIdentifierRisk.test(normalized) ||
    privateBrowserOpaqueEncodingRisk.test(normalized) ||
    privateBrowserNetworkAddressRisk(normalized) ||
    privateBrowserSecretRisk.test(normalized) ||
    /(?:\p{Nd}[\s\p{Zs}\p{Pd}().+\/,\u066B\u066C\u060C]*){7,}/u.test(normalized) ||
    /\b(?:seu|sua)\s+(?:site|pagina|landing\s+page|dominio|campanha|loja|anuncio)\s+(?:(?:ja|foi|esta|ficou)\s+){1,3}(?:publicad[ao]|ativad[ao]|entregue|configurad[ao]|rodando|no\s+ar|online)\b/u.test(normalized) ||
    privateBrowserUnsupportedAuthority.test(normalized) ||
    privateBrowserUnsupportedKpi.test(normalized) ||
    privateBrowserUnsupportedRank.test(normalized) ||
    privateBrowserUnsupportedGuarantee.test(normalized) ||
    privateBrowserUnsupportedProjection.test(normalized)
  );
}
// Independent browser egress for Luna/Terra general replies: the private
// HTTP server already forbids company offers, prices and first-person claims.
// A misconfigured localhost adapter must not make an unchecked company
// statement look like an approved model answer merely by supplying model IDs.
const privateBrowserGeneralMoney = /r\$|[$€£]|\b(?:precos?|valores?|cust[ao]s?|cobra[mn]?|cobram|cobranca|orcamentos?|cotacao|investimento|descontos?|pagamentos?|parcelas?|mensalidades?|reais|brl|usd|pagar|comercializa|gratuit[oa]s?|bonificacoes?)\b/u;
const privateBrowserGeneralCompany = /\b(?:imagine|faisca|nosso|nossa|oferecemos|entregamos|garantimos|aprovamos|enviamos|cobramos)\b/u;
const privateBrowserReportedExecution = /\b(?:publiquei|publicamos|configurei|configuramos|ativei|ativamos|enviei|enviamos|agendei|agendamos|cadastrei|cadastramos|integrei|integramos|instalei|instalamos|criei|criamos|aprovei|aprovamos|contratei|contratamos|finalizei|finalizamos|liberei|liberamos|lancei|lancamos|coloquei|colocamos|subi|subimos|hospedei|hospedamos|disponibilizei|disponibilizamos)\b/u;
// R205: an independent browser-only denial for forged HTTP 200 general prose.
const privateBrowserFreeStatistics =
  /\b\d{1,3}(?:[.,]\d{1,2})?\s*(?:%|por\s+cento)|\b\d{1,6}\s+(?:nov[oa]s?\s+)?(?:vendas?|clientes?|leads?|conversoes?|inscricoes?|visitas?|acessos?)\b|\b(?:pesquisas?|estudos?|relatorios?|levantamentos?|estatisticas?|especialistas?)\s+(?:(?:recentes?|independentes?)\s+)?(?:mostram?|indicam?|revelam?|apontam?|comprovam?|confirmam?)\b/u;
const privateBrowserWordStatistics =
  /\b(?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento)(?:\s+(?:e\s+)?\w+){0,4}\s+(?:por\s+cento|(?:nov[oa]s?\s+)?(?:vendas?|clientes?|leads?|inscricoes?|visitas?|acessos?))\b|\b(?:um|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|\d{1,3})\s+(?:em|de)\s+cada\s+(?:um|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|\d{1,3})\b/u;
const privateBrowserFutureOperation =
  /\b(?:vou|vamos|irei|iremos)\s+(?:publicar|ativar|configurar|cadastrar|integrar|criar|aprovar|contratar|instalar|enviar|agendar|abrir\s+(?:um\s+)?(?:chamado|ticket)|gerar\s+(?:um\s+)?(?:pedido|lead|cobranca))\b|\b(?:seu|sua)\s+(?:site|pagina|landing\s+page|campanha|pedido)\b.{0,70}\b(?:sera|vai\s+ser)\s+(?:publicad[oa]|ativad[oa]|configurad[oa]|cadastrad[oa]|criad[oa])\b/u;
// Browser-only defense against spoofed private model output (not production DLP).
const privateBrowserPiiRisk = text =>
  /(?!\p{Script=Latin})\p{L}/u.test(text) ||
  /@|\b(?:cpf|cnpj|rg|cep|telefone|celular|whatsapp|e-?mail|pix|senha|token|credenciais?|otp|totp|2fa|passaporte|chave|cartao)\b/u.test(
    text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase());
function privateBrowserGeneralReplySafe(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.normalize('NFKC').normalize('NFKD')
    .replace(/\p{M}/gu, '').toLowerCase();
  return !privateBrowserGeneralMoney.test(normalized) &&
    !privateBrowserGeneralCompany.test(normalized) &&
    !privateBrowserReportedExecution.test(normalized) &&
    !privateBrowserFreeStatistics.test(normalized) &&
    !privateBrowserWordStatistics.test(normalized) &&
    !privateBrowserFutureOperation.test(normalized);
}
let pending = false;
let pageEpoch = 0;
let currentController = null;
const MAX_PRIVATE_RESPONSE_BYTES = 16384;
// The AbortSignal is advisory to fetch implementations. An injected or
// non-cooperative transport may never settle its Promise after abort; the
// browser must still release the private operator UI at the 35s deadline.
// The server has its own earlier deadline and fail-closed session breaker.
async function fetchPrivateBeforeDeadline(url, options, signal) {
  if (signal.aborted) throw new Error('private_response_timeout');
  let onAbort;
  const interrupted = new Promise((_, reject) => {
    onAbort = () => reject(new Error('private_response_timeout'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([fetch(url, options), interrupted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
// The browser's AbortSignal does not guarantee that a custom or broken
// ReadableStream will ever resolve reader.read(). Bound each wait independently
// so the operator can recover after the 35-second UI deadline.
async function readAbortablePrivateChunk(reader, signal) {
  if (signal.aborted) throw new Error('private_response_timeout');
  let onAbort;
  const interrupted = new Promise((_, reject) => {
    onAbort = () => reject(new Error('private_response_timeout'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([reader.read(), interrupted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
async function readBoundedPrivateJson(response, signal) {
  const declared = response.headers.get('content-length');
  if (declared !== null &&
      (!/^[0-9]+$/.test(declared) || Number(declared) > MAX_PRIVATE_RESPONSE_BYTES)) {
    throw new Error('private_response_too_large');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('private_response_missing');
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      if (signal.aborted) throw new Error('private_response_timeout');
      const item = await readAbortablePrivateChunk(reader, signal);
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > MAX_PRIVATE_RESPONSE_BYTES) throw new Error('private_response_too_large');
      chunks.push(item.value);
    }
    const payload = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { payload.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload));
  } finally {
    // cancel() may itself never settle. Do not trap the UI in cleanup after
    // a deadline or malformed response. Ignore failures without leaking data.
    try { void Promise.resolve(reader.cancel()).catch(() => {}); }
    catch { /* cancellation is best effort */ }
  }
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending) return;
  // An invalid second attempt must never leave a previous response and its
  // editorial citations onscreen as if they belonged to the new question.
  answer.textContent = 'Nenhuma resposta validada para esta solicitação.';
  sources.textContent = '';
  const reviewToken = token.value.trim(), caseId = scenario.value;
  const typed = question?.value ?? '';
  const openQuestion = Boolean(conversation && (typed.trim() !== '' || attestation?.checked));
  // Clear the DOM immediately; the operator must explicitly supply a new
  // transient bearer for any further paid request. Never persist it.
  token.value = '';
  // Only a validated fictional question or one of the three fixed case IDs
  // can leave this temporary browser session. Never persist the bearer.
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(reviewToken) || !validCases.has(caseId)) {
    // Invalid bearer or scenario must not retain accidentally pasted input.
    if (question) question.value = '';
    if (attestation) attestation.checked = false;
    status.textContent = 'Confira o token de revisão e escolha uma pergunta fictícia.';
    return;
  }
  if (openQuestion && (!attestation?.checked || typed.trim().length < 12 ||
      typed.length > 240 || !privateFictionalQuestionPreflight(typed))) {
    // A rejected private question may contain accidentally pasted personal
    // information. Never leave it in the textarea for another attempt.
    if (question) question.value = '';
    if (attestation) attestation.checked = false;
    status.textContent = 'Escreva a pergunta e confirme que ela é fictícia.';
    return;
  }
  pending = true;
  // Drop operator text from the DOM before the first fetch; only the local
  // request closure holds the fictional string until the request finishes.
  if (question) question.value = '';
  if (attestation) attestation.checked = false;
  send.disabled = true;
  answer.textContent = 'Aguardando a resposta da IA...';
  sources.textContent = '';
  status.textContent = 'Solicitação privada enviada. Nenhum cliente foi consultado.';
  const requestEpoch = pageEpoch;
  const controller = new AbortController();
  currentController = controller;
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    const endpoint = openQuestion ? 'converse' : 'respond';
    const response = await fetchPrivateBeforeDeadline('/__faisca_openai_private/' + endpoint, {
      method:'POST', headers: {
        'Content-Type':'application/json',
        Authorization:'Bearer ' + reviewToken
      },
      body:JSON.stringify(openQuestion ? [true,typed] : {caseId}), redirect:'error',
      credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer',
      signal:controller.signal
    }, controller.signal);
    if (response.status !== 200) throw new Error('review_unavailable');
    const data = await readBoundedPrivateJson(response, controller.signal);
    // A bfcache restoration must not render a late response belonging to a
    // session the operator already left, even if abort was ignored by fetch.
    if (requestEpoch !== pageEpoch) return;
    const fixed = !openQuestion;
    const validStatus = fixed ? data?.status === 'draft_answer' :
      ['general_answer','editorial_answer','needs_confirmation'].includes(data?.status);
    const editorial = fixed || data?.status === 'editorial_answer';
    const generated = fixed || data?.status === 'general_answer';
    const sourcesOk = Array.isArray(data?.sources) &&
      data.sources.length <= 12 &&
      data.sources.every(id => typeof id === 'string' &&
        /^[a-z0-9][a-z0-9._:/@-]{0,127}$/i.test(id) &&
        reviewedPrivateSourceIds.has(id)) &&
      new Set(data.sources).size === data.sources.length &&
      (editorial ? data.sources.length > 0 : data.sources.length === 0);
    // An HTTP 200 may contain an allowed citation but a fabricated editorial
    // answer. The private browser validates exact reviewed pricing/process
    // text and source order independently of the server's receipt boolean.
    const editorialReceiptOk = fixed || !editorial ||
      (Array.isArray(data?.sources) && reviewedPrivateEditorialReceipts.some(receipt =>
        data.answer === receipt.text &&
        data.sources.length === receipt.sources.length &&
        data.sources.every((id, index) => id === receipt.sources[index])));
    // A 200 response cannot invent a company-specific confirmation message.
    // It must match the host-owned exact text, independently of the server.
    const confirmationReceiptOk = data?.status !== 'needs_confirmation' ||
      (!fixed && data.answer === reviewedPrivateConfirmationText);
    const modelsOk = Array.isArray(data?.models) &&
      (generated ? (data.models.length === 2 &&
        data.models[0] === 'gpt-6-luna' && data.models[1] === 'gpt-6.1-terra')
        : data.models.length === 0);
    // R06 approved recipes contain literal LF line breaks. Allow those only
    // when the free editorial response matches the exact pinned text and
    // ordered sources. Never relax this for model output or fixed scenarios.
    const pinnedEditorialLinefeeds = !fixed && editorial && editorialReceiptOk;
    if (!validStatus || !sourcesOk || !modelsOk || !editorialReceiptOk ||
        !confirmationReceiptOk ||
        data?.schema !== (fixed
          ? 'faisca.openai-private-review-response.v1'
          : 'faisca.openai-private-conversation-response.v1') ||
        (fixed && data.syntheticCaseId !== caseId) ||
        data.requiresEditorialReview !== true ||
        typeof data.answer !== 'string' || data.answer.length < 20 || data.answer.length > 900 ||
        /[\u0000-\u0009\u000b-\u001f\u007f<>]/u.test(data.answer) ||
        (/\n/u.test(data.answer) && !pinnedEditorialLinefeeds) ||
        !privateBrowserReplyEgressSafe(data.answer) ||
        (['draft_answer', 'general_answer'].includes(data?.status) &&
          privateBrowserPiiRisk(data.answer)) ||
        (data?.status === 'general_answer' &&
          !privateBrowserGeneralReplySafe(data.answer)) ||
        // Preserve the strict R88 fixed-scenario proof and check free text separately.
        (fixed && data.sourceRecipeBound !== true) ||
        (!fixed && data.sourceRecipeBound !== (editorial ? true : false)) ||
        data.publicReady !== false || data.operationalEffects !== false) {
      throw new Error('review_unavailable');
    }
    // No HTML interpretation of the model or editorial reply.
    answer.textContent = data.answer;
    sources.textContent = editorial ? 'Fontes editoriais: ' + data.sources.join(', ') : '';
    if (generated) {
      status.textContent = 'Resposta gerada. Revisão editorial obrigatória; nenhuma operação foi realizada.';
    } else if (editorial) {
      status.textContent = 'Resposta baseada no material editorial aprovado pela Imagine.';
    } else {
      status.textContent = 'Esta pergunta requer confirmação da equipe da Imagine.';
    }
  } catch {
    if (requestEpoch === pageEpoch) {
      answer.textContent = 'Resposta indisponível neste teste.';
      status.textContent = 'A revisão privada não concluiu. Confira a sessão e os limites no servidor.';
    }
  } finally {
    clearTimeout(timeout);
    if (currentController === controller) currentController = null;
    if (question) question.value = '';
    if (attestation) attestation.checked = false;
    pending = false;
    send.disabled = false;
  }
});
window.addEventListener('pagehide', () => {
  pageEpoch++;
  currentController?.abort();
  answer.textContent = 'A resposta validada aparecerá aqui após uma chamada real.';
  sources.textContent = '';
  status.textContent = 'Sessão privada encerrada; forneça um novo token.';
  token.value = '';
  if (question) question.value = '';
  if (attestation) attestation.checked = false;
});
`;
