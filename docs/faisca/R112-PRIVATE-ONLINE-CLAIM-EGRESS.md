# R112 — alegações de campanha/site no ar na saída privada

**DRAFT / laboratório.** Base R111 #586 na SHA `f07ca4462cca26c4a8f0ce6d99a25a51aa025a48`. Nenhuma branch concorrente modificada.

## Defeito e correção

Os filtros R106/R110 bloqueavam principalmente verbos como "publiquei" e "ativei". Um resultado de IA com frase como "Seu domínio já está online" ou "Sua campanha está rodando" poderia passar com fontes e modelos aparentemente válidos, embora o laboratório não tenha acesso a publicação, campanhas ou domínio.

A R112 acrescenta verbos de ações concluídas e estados de ativos do visitante ao mesmo detector compartilhado por respostas fixas e livres. Mantém a permissão para orientações **genéricas** no condicional, sem afirmar que algo foi executado. Não utiliza modelo real, dados pessoais nem integrações externas.

`tests/faisca-r112-private-online-claims.test.mjs` prova detecção textual, HTTP 503 sem reflexão das alegações em ambas as rotas com adaptador sintético, e dois controles positivos HTTP 200. O detector continua lexical e não substitui revisão humana de factualidade, falsos positivos e alinhamento editorial.

## Gates

CI Node, HTTP, Chromium/axe, Portal Onepage, PHP, PostgreSQL descartável e Comercial/SEO na HEAD final; revisão AppSec/editorial independente; staging privado pelo operador, sem presumir R95–R112 instalada e sem repetir homologação R92 já relatada como concluída. `publicFaiscaEnabled=false`; sem merge, deploy, DNS, VPS, credenciais, chamadas pagas, dados reais, CRM/Portal operacional, leads, tickets ou cobrança.
