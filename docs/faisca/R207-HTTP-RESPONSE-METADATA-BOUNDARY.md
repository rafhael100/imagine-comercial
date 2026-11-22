# R207 — validação independente dos metadados HTTP no navegador privado

**Escopo:** revisão Luna/Terra exclusivamente fictícia e local. Branch empilhada sobre a HEAD R206 `c1c9d24b54194830bd4ee9bb0d6136d14617b642`. Sem alteração da `main`, mascote ou rota pública.

## Risco e correção

Antes desta entrega, o navegador checava o status HTTP 200 e validava o JSON de resposta, mas não exigia o **tipo de mídia JSON** nem a **URL exata do endpoint**. Assim, um transporte adulterado ou um proxy incorreto poderia enviar texto JSON sob `text/html`/outro tipo e ainda assim chegar à validação de conteúdo. O operador não deve confundir uma resposta fora do contrato HTTP com uma resposta validada.

A resposta agora é negada antes da leitura do corpo se qualquer um destes sinais falhar:

- status exato **200**;
- sem `response.redirected`;
- URL final igual ao endpoint privado escolhido (`respond` ou `converse`) sob a origem atual;
- `Content-Type` apenas `application/json`, com `charset=utf-8` opcional (sem tipos ou parâmetros extras).

Permanece a política de `fetch` com `redirect:'error'`, `credentials:'omit'`, `cache:'no-store'` e `referrerPolicy:'no-referrer'`. A resposta rejeitada não aparece, o token e a pergunta são limpos, e não há retry nem chamada adicional à OpenAI.

## Evidências executáveis

- `node --test tests/faisca-r207-private-response-boundary.test.mjs`: servidor em loopback, confirmação de JSON/URL sem redirect, no-store e nenhuma chamada paga.
- `node ops/faisca/openai/private-conversation-browser-qa.mjs`: Chromium com cinco HTTP 200 sintéticos: três tipos de mídia recusados e dois tipos JSON permitidos; verifica resposta negada, limpeza de campos, ausência de novas chamadas ao provedor. A suíte mantém também axe/WCAG e controles anteriores.
- `npm test` e workflows Node/Chromium, Comercial/SEO e compatibilidade em PR draft.

**Limites:** estas verificações atestam apenas o contrato local/sintético. Não asseguram autenticidade da resposta em rede comprometida, faturamento da OpenAI, revisão factual total nem implantação na VPS. R92 foi homologada manualmente segundo o operador; R95–R207 precisam de evidência operacional separada antes de qualquer uso externo.

**NO-GO:** `publicFaiscaEnabled=false`, sem deploy, merge, DNS, Portal/Sites operacionais, leads, tickets, cobranças, dados pessoais ou chaves reais.
