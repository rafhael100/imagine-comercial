# R108 — impedir repetição de gastos após falha ou saída insegura do provedor

**DRAFT / laboratório privado.** Base imutável R107 #582: `018d4843f0b49defb5ae1465d60f2c2115eb45f0`. Nenhuma implantação realizada.

## Falha e risco

A R107 bloqueia novas chamadas após timeout HTTP. Contudo, uma exceção imediata do adaptador ou uma resposta sintética malformada/sem vínculo editorial retornava 503 sem acionar o bloqueio. O operador podia reenviar o formulário e provocar novas chamadas potencialmente pagas contra o mesmo provedor sem corrigir o defeito. Não é possível garantir que a primeira chamada não tenha sido cobrada.

## Correção executável

- Depois de qualquer falha no processamento do provedor (exceção, saída não fundamentada, proveniência inválida ou timeout), `providerUnavailable=true` até encerramento e revisão pelo operador. Não há retry automático, não há reembolso implícito do ledger.
- Rejeições de entrada anteriores ao despacho continuam HTTP 400/403; o bloqueio ocorre apenas dentro do ciclo do provedor.
- R107 permanece aplicável: requisições paralelas retornam 429, timeout retorna 503 e resposta tardia não reabre a sessão.
- `tests/faisca-r108-private-provider-failure-latch.test.mjs` cobre quatro cenários Node/HTTP em `127.0.0.1`: resposta fictícia operacional falsa, exceção com segredo fictício (sem refletir detalhes), ausência de fontes no caso fixo e respostas seguras consecutivas.
- O teste não chama OpenAI; os exemplos não contêm dados reais.

## Limitações e gates

O disjuntor é por processo e não substitui o ledger durável R82–R100, custo real da OpenAI, limite entre servidores ou revisão de cobrança. Reiniciar a sessão requer conferir o estado e eventuais custos incertos. Toda evidência de CI deve estar associada à **SHA exata**, incluindo Node/HTTP/Chromium/axe e workflows Portal/PHP/PostgreSQL/SEO.

Antes de homologar nova versão: revisão AppSec independente e staging privado pinado com operador autorizado; respeitar a homologação R92 relatada, sem presumir R95–R108 instaladas. Para atendimento público exigem-se ainda Portal real (identidade, empresa, autoridade, oferta, contrato, aceite e recibo), revisão editorial, acessibilidade e GO explícito.

**NO-GO:** `publicFaiscaEnabled=false`; manter intactos mascote, site público, main, VPS, DNS, serviços pagos e CRM/Portal operacionais. Nenhuma credencial, chave, dado real, lead, ticket ou cobrança no GitHub.
