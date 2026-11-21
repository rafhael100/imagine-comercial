# Faísca R190 — HTTP privado sob erro de reserva durável

## Contrato de ponta a ponta
R188 fecha a ambiguidade da confirmação da reserva e R189 aplica
as proteções de hardlink da R186 sem merge de PRs. R190 exercita o
**servidor HTTP real** de revisão da R79/R95 em loopback, com o
adaptador real e armazenamento simulado/descartável. Dois testes
provam HTTP 503 genérico, no-store, sem CORS, sem exposição da falha
interna, sem despacho OpenAI e sem segunda tentativa.

Casos:
1. Uma função reserve fictícia grava e perde confirmação antes
   de qualquer fetch; o breaker do HTTP e o latch do adaptador
   recusam a requisição seguinte.
2. Um ledger local real em pasta 0700 recebe hardlink externo
   do estado; a reserva falha, mantém o lock, e ambos os POSTs
   obtêm somente status unavailable.

`node --test tests/faisca-r190-private-http-ledger-failclosed.test.mjs`

## Limites
O teste **não** representa um serviço implantado no staging ou na
VPS, não roda contra a API OpenAI, não usa dados reais nem verifica
faturamento. Deve passar no CI exato juntamente com Node/Chromium/
axe/WCAG, Portal/Onepage, PHP/PG descartável e Comercial/SEO/build.

A homologação R92 e testes pagos Luna/Terra anteriores relatados
pelo operador não foram repetidos. R95+ em staging permanece sem
evidência operacional direta. Revisões AppSec/LGPD/FinOps/editorial
e conciliação independente continuam pendentes.

NO-GO público: preservar `main`, site público, mascote aprovado e
`publicFaiscaEnabled=false`. Não executar merge/deploy, alterar
VPS/DNS, operar CRM/Portal/Sites, cobrar, criar leads ou tickets.
