# Faísca R79 — Interface visual de revisão privada da OpenAI

**Base revisada:** R78 [PR #551](https://github.com/rafhael100/imagine-comercial/pull/551), SHA `34e80331e434fa225bf5443e8e3135701b188844`. Continuidade da integração R72. **Somente laboratório; sem publicação pública.**

## Entrega

A interface de revisão privada é servida somente por um servidor Node que escuta `127.0.0.1`. O endereço `/__faisca_openai_private/review` exibe um formulário acessível que permite ao operador escolher **uma entre três perguntas fictícias** (`compare`, `process`, `pricing`) e fornecer um **token de revisão separado**. Não existe caixa de texto livre de clientes.

O script da página usa `fetch` com `Authorization: Bearer` somente para o caminho `/__faisca_openai_private/respond`, sem cookies, sem redirecionamento, sem armazenamento no navegador e sem expor `OPENAI_API_KEY`. O texto devolvido é exibido por `textContent`, nunca executado como HTML. A página não revela segredos e não aciona a API ao ser aberta.

O servidor mantém as proteções R73–R78, inclusive body HTTP canônico/limitado, deadline, resposta validada, limite de uma chamada ativa e bloqueio de alegações comerciais proibidas. Para `POST`, ele aceita somente ausência de Origin (cliente terminal) ou **Origin exata do próprio loopback** (página privada) mais o Bearer válido. Requisições externas, outros Hosts, cookies e headers de proxy continuam bloqueados. HTML/CSS/JS têm CSP restrita, noindex, no-store e não habilitam CORS.

## Verificações

```sh
node --test tests/faisca-r79-private-browser-security.test.mjs
node --test tests/faisca-r7*.test.mjs
```

A suíte de R79 verifica assets reais via HTTP no loopback, headers, Host, Origin, token, resposta de rascunho, ausência de credenciais e rejeição de acesso externo. As suítes do Faísca, Portal, PHP e navegador devem passar **na HEAD exata** dessa PR. A CI não realiza chamadas pagas e não prova operação real da VPS.

## Procedimento para abrir a interface na VPS (somente após revisão da PR)

1. Preparar um checkout isolado de R79 na VPS, **sem modificar o checkout R72 ou outros projetos**, e instalar dependências Node 22.
2. Em terminal privado, injetar a chave `OPENAI_API_KEY` pelo mecanismo de segredos e definir `IMAGINE_FAISCA_OPENAI_LIVE_TEST=YES_PAY_SYNTHETIC_ONLY`. Gerar um segundo segredo exclusivo `FAISCA_REVIEW_BEARER_TOKEN` (32–128 caracteres ASCII alfanuméricos, hífen ou underscore). Não compartilhar nenhum segredo em Git, issues, mensagens ou screenshots.
3. Iniciar `node scripts/faisca-openai-private-review-server.mjs`, que permanece **somente em 127.0.0.1:4336**, sem Docker/DNS/proxy público. O laboratório admite no máximo duas chamadas por processo (Luna e Terra para uma pergunta aprovada).
4. No Windows, abrir um **segundo** PowerShell com túnel SSH, mantendo a sessão aberta:

```powershell
ssh -N -L 127.0.0.1:4336:127.0.0.1:4336 -o IdentitiesOnly=yes -i "$HOME\.ssh\imagine_vps" rafhael@85.17.188.240
```

5. Abrir no navegador Windows `http://127.0.0.1:4336/__faisca_openai_private/review`, digitar **somente o token de revisão** (não a API key), escolher uma pergunta fictícia e clicar em **Gerar resposta pela IA**.
6. Avaliar a resposta em português e as fontes editoriais, conferir consumo efetivo no painel OpenAI API e encerrar servidor e túnel. Não confundir `estimatedReservedUsd` com custo faturado.

**O endpoint HTTP continua em modo laboratório:** não há identidade de cliente, fluxo de contratação, mensagens livres, CRM, tickets, checkout, armazenamento de conversas ou autorização para operar em produção. O saldo dos créditos e um primeiro teste real bem-sucedido não substituem revisão AppSec/LGPD, orçamento financeiro durável, homologação na VPS, observabilidade e GO de publicação. `publicFaiscaEnabled=false`. Mascote e site público preservados.
