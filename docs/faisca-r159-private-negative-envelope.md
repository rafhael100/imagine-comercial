# Faísca R159 — resultado semântico do preflight privado em staging

## Lacuna e mitigação

A R154 considerava um HTTP 400 com cabeçalhos corretos evidência suficiente de rejeição da pergunta fictícia sensível. Um fallback do aplicativo ou um intermediário que respondesse 400 por outra causa (por exemplo, `invalid_request`) poderia ser incorretamente interpretado pela R157 como prova da barreira de privacidade, liberando o POST positivo que potencialmente consome créditos.

A R159 passa a exigir **os bytes exatos** do envelope já emitido pelo servidor privado: `{"status":"invalid_question"}\n`. O corpo é lido apenas na memória, com limite de comprimento igual ao envelope e mesmo prazo absoluto do POST; JSON duplicado, corpo truncado, excesso, ausência de EOF, `Content-Length` incompatível ou 400 genérico causam NO-GO. Não há exibição, registro, persistência ou retorno do corpo; o relatório continua contendo somente status e contadores.

Esta mudança não mexe nas perguntas fictícias, prompts, contratos da API, HTML/JS/CSS, mascote ou rotas públicas. O teste HTTP real continua em loopback com token sintético, sem rede externa de IA.

## Executar no laboratório

```bash
node --test tests/faisca-r159-private-rejection-envelope.test.mjs
node --test tests/faisca-r157-private-staging-sequence.test.mjs tests/faisca-r158-durable-model-sequence.test.mjs
```

A CI deve exercer Node/HTTP, Chromium/axe, integração Portal/Onepage, PHP R05/R06, PostgreSQL descartável, SEO e build na HEAD exata.

## Limites, dependências e NO-GO

HTTP 400 com o corpo correto não comprova, sozinho, que nenhum modelo foi chamado: adaptadores maliciosos poderiam responder corretamente após o dispatch. Continuam pendentes revisão AppSec/LGPD/FinOps/editorial, homologação privada acumulada no staging autorizado e conciliação independente com ledger e provedor.

Respeitar R92 já homologada pelo operador e o teste pago anterior Luna/Terra sem repetição desnecessária. Nenhuma instalação de R95–R159 na VPS é presumida. Não utilizar credenciais, dados reais, rede pública de IA ou sistemas operacionais CRM/Portal/Sites. Manter `main`, site público, mascote aprovado e `publicFaiscaEnabled=false` intocados; sem deploy, merge ou GO público.
