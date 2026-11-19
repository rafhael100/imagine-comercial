// R79: Browser presentation of *fixed synthetic scenarios only*.
// This is neither the public Faísca widget nor a raw-message chat interface.
// The browser receives no OpenAI API key; the operator supplies a separate
// temporary review bearer token only in memory, never in storage or URLs.
export const PRIVATE_REVIEW_PAGE_PATH = '/__faisca_openai_private/review';
export const PRIVATE_REVIEW_SCRIPT_PATH = '/__faisca_openai_private/review.js';
export const PRIVATE_REVIEW_STYLE_PATH = '/__faisca_openai_private/review.css';

export const PRIVATE_REVIEW_HTML = String.raw\`<!doctype html>
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
<label for="review-case">Pergunta fictícia</label>
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
</body></html>\`;

export const PRIVATE_REVIEW_CSS = String.raw\`:root{color-scheme:light;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8faf8;color:#25312c}
*{box-sizing:border-box}body{margin:0}main{max-width:740px;padding:1.2rem;margin:1.4rem auto}
header{padding:1.1rem 0}header h1{font-size:2.35rem;letter-spacing:-.06em;margin:.3rem 0}
header h1 span{color:#f9941d}.eyebrow{color:#865513;letter-spacing:.16em;font-size:.8rem;font-weight:800}
section{border:1px solid #cad5cd;border-radius:15px;padding:1.35rem;margin:1.1rem 0;background:#fff}
section h2{font-size:1.1rem;margin:0 0 1rem}
form{display:grid;gap:.7rem}label{font-weight:700}
input,select,button{font:inherit;min-height:44px;border-radius:8px;padding:.65rem .8rem}
input,select{border:1px solid #738679;width:100%;background:#fff;color:#25312c}
button{border:0;background:#25312c;color:#fff;font-weight:700;cursor:pointer;margin-top:.4rem}
button:disabled{opacity:.65;cursor:default}
:focus-visible{outline:3px solid #c76e00;outline-offset:3px}
.help,footer{font-size:.87rem;color:#4d5d55}
#review-status{min-height:2.5rem;font-weight:600}
#review-answer{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65}
footer{padding:.8rem 0;line-height:1.5}
@media(max-width:420px){main{padding:.75rem;margin:.5rem auto}section{padding:1rem}}
\`;

export const PRIVATE_REVIEW_JS = String.raw\`const form = document.getElementById('faisca-review-form');
const token = document.getElementById('review-token');
const scenario = document.getElementById('review-case');
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
  // All visitor-controlled values are bounded and only the case ID leaves
  // the browser. Do not store the bearer or the generated text.
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(reviewToken) || !validCases.has(caseId)) {
    status.textContent = 'Confira o token de revisão e escolha uma pergunta fictícia.';
    return;
  }
  pending = true;
  send.disabled = true;
  answer.textContent = 'Aguardando a resposta da IA...';
  sources.textContent = '';
  status.textContent = 'Solicitação privada enviada. Nenhum cliente foi consultado.';
  try {
    const response = await fetch('/__faisca_openai_private/respond', {
      method:'POST', headers: {
        'Content-Type':'application/json',
        Authorization:'Bearer ' + reviewToken
      },
      body:JSON.stringify({caseId}), redirect:'error',
      credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer'
    });
    const data = await response.json();
    if (response.status !== 200 || data?.status !== 'draft_answer' ||
        typeof data.answer !== 'string' || data.answer.length > 900 ||
        !Array.isArray(data.sources) || data.publicReady !== false ||
        data.operationalEffects !== false) {
      throw new Error('review_unavailable');
    }
    // All output, including model text, is displayed as plain text.
    answer.textContent = data.answer;
    sources.textContent = 'Fontes editoriais: ' + data.sources.join(', ');
    status.textContent = 'Resposta gerada. Revisão editorial obrigatória; nenhuma operação foi realizada.';
  } catch {
    answer.textContent = 'Resposta indisponível neste teste.';
    status.textContent = 'A revisão privada não concluiu. Confira a sessão e os limites no servidor.';
  } finally {
    pending = false;
    send.disabled = false;
  }
});
window.addEventListener('pagehide', () => { token.value = ''; });
\`;
