# Faísca R294 — documentos financeiros e Pix: confirmação editorial obrigatória

**Base:** R293 #773, HEAD `a37e27e8161fa5e47a60ffd993ac69ded790950c`. Incremento privado, sem integração operacional.

O Faísca ainda não tem autenticação de cliente, autorização de acesso à cobrança, nem leitura de fonte oficial de boleto, fatura, nota fiscal, recibo ou Pix. Perguntas que mencionem esses artefatos são encaminhadas para confirmação humana ou recusadas conservadoramente por um preflight anterior, **sem chamar Luna ou Terra**, evitando uma resposta baseada em política genérica de preços ou uma afirmação sobre o estado de pagamento.

O filtro de saída dos modelos também rejeita esses termos em respostas livres, pois afirmar a emissão, disponibilidade, quitação ou confirmação não é sustentado por evidência do ambiente privado. É um tripwire lexical deliberadamente conservador: não decide se houve pagamento e pode recusar conselhos genéricos. Os modelos seguem sem autoridade de Portal, CRM, Sites, fiscal ou cobrança.

`node --test tests/faisca-r294-private-billing-artifacts.test.mjs` cobre rotas de perguntas fictícias sem custo (incluindo recusa conservadora), respostas não verificadas barradas, HTTP 503 higienizado, ausência de cookies/CORS e permanência da orientação geral não financeira. CI completa continua exigida para Node/HTTP, Chromium/axe/WCAG, SEO/build, Portal/Onepage, PostgreSQL descartável e PHP.

Sem dados reais, credenciais, chamada paga, merge, deploy ou mudança na VPS/DNS; preservados `main`, site público, mascote e `publicFaiscaEnabled=false`. A instalação R95 continua sem atestado direto Docker/PID/HTTP. **NO-GO público**; revisão AppSec, LGPD, FinOps e editorial ainda obrigatória.
