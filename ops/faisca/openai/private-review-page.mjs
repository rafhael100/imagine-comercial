// Browser presentation of fixed cases and optional operator-attested fictional questions.
// The browser receives no OpenAI API key; the operator supplies a separate
// temporary review bearer token only in memory, never in storage or URLs.
export const PRIVATE_REVIEW_PAGE_PATH = '/__faisca_openai_private/review';
export const PRIVATE_REVIEW_SCRIPT_PATH = '/__faisca_openai_private/review.js';
export const PRIVATE_REVIEW_STYLE_PATH = '/__faisca_openai_private/review.css';

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
<header><p class="eyebrow">IMAGINE · LABORATÓRIO PRIVADO</p>
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
header{padding:1.1rem 0}header h1{font-size:2.35rem;letter-spacing:-.06em;margin:.3rem 0}
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
let pending = false;

form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending) return;
  const reviewToken = token.value.trim(), caseId = scenario.value;
  const text = question?.value.trim().normalize('NFC') ?? '';
  const openQuestion = Boolean(conversation && (text !== '' || attestation.checked));
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(reviewToken) || !validCases.has(caseId)) {
    status.textContent = 'Confira o token de revisão e escolha uma pergunta fictícia.';
    return;
  }
  if (openQuestion && (!attestation.checked || text.length < 12)) {
    status.textContent = 'Escreva a pergunta e confirme que ela é fictícia.';
    return;
  }
  // Never persist the bearer or include it in a URL.
  token.value = '';
  pending = true;
  send.disabled = true;
  answer.textContent = 'Aguardando a resposta da IA...';
  sources.textContent = '';
  status.textContent = 'Solicitação privada enviada. Nenhum cliente foi consultado.';
  try {
    const endpoint = openQuestion ? 'converse' : 'respond';
    const response = await fetch('/__faisca_openai_private/' + endpoint, {
      method:'POST', headers: {
        'Content-Type':'application/json',
        Authorization:'Bearer ' + reviewToken
      },
      body:JSON.stringify(openQuestion ? [true, text] : {caseId}), redirect:'error',
      credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer'
    });
    const data = await response.json();
    if (openQuestion && response.status === 400 && data?.status === 'invalid_question') {
      answer.textContent = 'Reformule a pergunta fictícia ou confirme o assunto com a equipe.';
      status.textContent = 'A pergunta não foi enviada à IA.';
      return;
    }
    const schema = openQuestion
      ? 'faisca.openai-private-conversation-response.v1'
      : 'faisca.openai-private-review-response.v1';
    const draft = data?.status === 'general_answer' || data?.status === 'draft_answer';
    const editorial = data?.status === 'editorial_answer' || data?.status === 'draft_answer';
    const validStatus = openQuestion
      ? ['general_answer', 'editorial_answer', 'needs_confirmation'].includes(data?.status)
      : data?.status === 'draft_answer' && data.syntheticCaseId === caseId;
    if (response.status !== 200 || data?.schema !== schema || !validStatus ||
        data.requiresEditorialReview !== true ||
        typeof data.answer !== 'string' || data.answer.length > 900 ||
        !Array.isArray(data.sources) || (data.sources.length > 0) !== editorial ||
        !Array.isArray(data.models) || data.models.length !== (draft ? 2 : 0) ||
        (draft && (data.models[0] !== 'gpt-6-luna' || data.models[1] !== 'gpt-6.1-terra')) ||
        data.publicReady !== false || data.operationalEffects !== false) {
      throw new Error('review_unavailable');
    }
    answer.textContent = data.answer;
    if (editorial) sources.textContent = 'Fontes editoriais: ' + data.sources.join(', ');
    if (draft) status.textContent = 'Resposta gerada. Revisão editorial obrigatória; nenhuma operação foi realizada.';
    else if (editorial) status.textContent = 'Resposta baseada no material aprovado pela Imagine.';
    else status.textContent = 'Confirmação da equipe necessária.';
  } catch {
    answer.textContent = 'Resposta indisponível neste teste.';
    status.textContent = 'A revisão privada não concluiu. Confira a sessão e os limites no servidor.';
  } finally {
    pending = false;
    send.disabled = false;
  }
});
window.addEventListener('pagehide', () => {
  token.value = '';
  if (question) question.value = '';
  if (attestation) attestation.checked = false;
});
`;
