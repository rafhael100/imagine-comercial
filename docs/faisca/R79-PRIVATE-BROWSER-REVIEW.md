# Faísca R79 — tela privada para revisar respostas reais da IA

**Base:** R78 PR #551, SHA `34e80331e434fa225bf5443e8e3135701b188844`. Draft/review-only.

## Objetivo

Permitir que o operador veja no navegador uma resposta gerada por Luna e Terra no backend privado, sem a API key entrar no navegador e sem ativar Faísca no site público. A tela tem três opções de perguntas **fictícias e previamente aprovadas** (comparação, processo, preço); não aceita texto de clientes ou conversas livres.

Arquivos:
- `ops/faisca/openai/private-review-page.mjs`: HTML, CSS e JS locais. O JS só envia `caseId` fechado, token de revisão Bearer transitório em memória, nenhuma persistência e modelo renderizado apenas via `textContent`.
- `ops/faisca/openai/private-review-http.mjs`: GET somente nos três assets da página, host exato `127.0.0.1`, Origin ausente ou exatamente igual à origem loopback, sem proxy/cookie, CSP restritiva; POST aceita apenas Origin ausente ou exata do mesmo loopback, mantendo a rejeição de origens externas.
- `tests/faisca-r79-private-browser-review.test.mjs` e `tests/faisca-r79-private-browser-security.test.mjs`: testes HTTP reais no loopback para GET/CSP, Origin exata/externa, token, POST e recusa de textos livres.
- `ops/faisca/openai/private-review-browser-qa.mjs`: teste Chromium, WCAG em 320/390/1440 px, resultado autenticado e token apagado imediatamente após envio; a CI executa este teste sem usar a API paga.

## Teste sem crédito de API

```sh
node --test tests/faisca-r79-private-browser-review.test.mjs tests/faisca-r79-private-browser-security.test.mjs
node --test tests/faisca-r72-openai-live-lab.test.mjs tests/faisca-r72-openai-private-http.test.mjs
```

## Abrir tela de revisão privada (pode consumir crédito)

Na VPS Linux, usando checkout revisado da branch R79, com chave da API injetada em variável de ambiente privada:

```sh
export IMAGINE_FAISCA_OPENAI_LIVE_TEST=YES_PAY_SYNTHETIC_ONLY
# OPENAI_API_KEY deve estar injetada por segredo privado; nunca publicar no Git.
# Gerar token de revisão independente da chave de API (48 caracteres hex).
export FAISCA_REVIEW_BEARER_TOKEN="$(openssl rand -hex 24)"
node scripts/faisca-openai-private-review-server.mjs
```

**Não abrir portas externas na VPS e não fazer deploy.** O processo permanece escutando somente `127.0.0.1:4336`.

Em um segundo terminal **do Windows local**, estabelecer túnel SSH autenticado para a VPS:

```powershell
ssh -i "$HOME\.ssh\imagine_vps" -o IdentitiesOnly=yes -L 4336:127.0.0.1:4336 <usuario-ssh>@<ip-da-vps>
```

Com o túnel ativo, abrir no navegador do Windows: `http://127.0.0.1:4336/__faisca_openai_private/review`.

A tela pede o **token de revisão** (`FAISCA_REVIEW_BEARER_TOKEN`), NÃO a OPENAI_API_KEY. O operador deverá transferir esse token apenas pelo canal privado sob seu controle. Nunca enviar token, chave ou capturas com eles ao chat, issue, PR ou GitHub.

O servidor de laboratório R72 usa um orçamento conservador de US$0,01 por processo e no máximo duas chamadas: Luna + Terra. Assim, uma resposta bem-sucedida consome as duas chamadas disponíveis e **novas perguntas exigirão reiniciar um novo processo**, após revisar o custo. O usuário autorizou ampliar os testes futuramente, mas isso não substitui orçamento distribuído, rate limit persistente ou aprovação operacional.

## Limitações e gates

- A página não é o site Comercial, nem o widget do mascote; ela é uma ferramenta de validação privada.
- Não há conversa livre, CRM, Portal, login, preço aprovado, pedido, pagamento, envio de lead/ticket ou obrigação operacional.
- A verificação lexical não equivale a revisão semântica; resposta marcada como rascunho requer validação humana.
- Exigir CI da HEAD R79, testes no navegador e revisão independente AppSec/LGPD, inclusive token, CSP, same-origin e túnel SSH, antes da homologação.
- Sem merge, deploy, VPS alterada por CI, portas públicas, DNS ou dados reais. `publicFaiscaEnabled=false`, arte do mascote e `main` preservadas.
