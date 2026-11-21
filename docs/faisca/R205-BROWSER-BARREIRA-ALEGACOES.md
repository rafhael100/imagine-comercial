# Faísca R205 — barreira independente de alegações no navegador privado

## Objetivo

As R201–R203 ampliaram a política do servidor/adapter Luna+Terra para rejeitar métricas e pesquisas sem fonte e falsas promessas de execução. Entretanto, um `HTTP 200` local adulterado ainda podia tentar fazer o navegador representar tais afirmações. A R205 acrescenta **defesa independente na interface privada**, sem confiar no status HTTP ou em `modelIds` declarados pelo payload.

## Implementação e evidências

- `privateBrowserGeneralReplySafe` agora recusa percentuais sem fundamento, contagens comerciais, métricas escritas por extenso, razões simples, pesquisas sem fonte e promessas futuras de publicação, ativação ou outras ações. Apenas respostas `general_answer` geradas passam por essa checagem adicional; receitas editoriais fixadas e sua validação exata permanecem intactas.
- O QA `ops/faisca/openai/private-conversation-browser-qa.mjs` exercita o Chromium real com seis respostas falsificadas, todas `HTTP 200`, metadados/modelos formalmente corretos e textos inseguros. Confere que o navegador não exibe tais textos, não conserva pergunta/token/atestado e não contata o provedor.
- Para preservar a trava de tamanho e integridade R94, foram condensados comentários explicativos redundantes **somente dentro do script privado**, sem relaxar 24 KiB, CSP, métodos HTTP, regras editoriais ou acesso ao mascot aprovado.

O detector lexical é intencionalmente conservador e **não certifica** veracidade, independência do provedor nem proteção completa contra todas as paráfrases. Continua obrigatório revisar exemplos editoriais, conferir uso/cobrança real e homologar todo o conjunto R95+ em staging privado.

## Verificação

```sh
npm test
node ops/faisca/openai/private-conversation-browser-qa.mjs
npm run test:browser
```

Somente laboratório com mensagens fictícias, respostas simuladas e navegador Chromium. Respeitados os testes pagos anteriores Luna/Terra e a homologação R92 relatada. Nenhuma credencial foi recebida nesta execução; nenhuma nova chamada paga foi tentada. Não presumir R95+ instalado na VPS.

**Sem GO público, merge ou deploy.** `main`, site público, mascote e `publicFaiscaEnabled=false` preservados. Nada de DNS, operação CRM/Portal/Sites, leads, tickets, cobranças, clientes ou dados reais.
