# Faísca R196 — barreira durável entre processos antes da chamada paga

## Risco e mudança

A R191/R195 bloqueia novas requisições depois de um resultado incerto, porém o marcador de incerteza só é gravado quando a falha ou desconexão é detectada. Dois processos do mesmo host poderiam passar pelo limite de reservas antes de o primeiro registrar a incerteza.

A R196 acrescenta `.faisca-provider-dispatch-inflight` no diretório privado do ledger. O arquivo é criado por `O_EXCL | O_NOFOLLOW`, escrito e sincronizado com `fsync` **antes de enviar a requisição ao provedor**. Enquanto ele existir, `ready()` e `reserve()` falham fechados em outros processos. O marcador é liberado somente pela instância proprietária depois de receber, validar e contabilizar a resposta da API; se o processo encerrar de modo abrupto ou houver erro do provedor, o marcador permanece para reconciliação humana. Nunca existe TTL, remoção automática ou retry pago.

O teste Node `node --test tests/faisca-r196-cross-process-paid-dispatch.test.mjs` cobre concorrência entre instâncias, término de processo independente e recusa de despacho antes de chamar o transporte simulado. `npm test` também o inclui.

## Limites relevantes

A exclusão é **somente local ao mesmo sistema de arquivos**, não coordena hosts distintos, snapshots ou rede NFS. O marcador não certifica a cobrança da OpenAI nem dispensa o bloqueio R194/R195 em caso de resposta HTTP não entregue. **Existe uma janela residual entre a confirmação de resposta da API e sua entrega ao navegador:** a R196 encerra o lock após confirmar a resposta upstream, não depois de um ACK de entrega. Esse gate precisa ser tratado em incremento separado antes de staging multi-worker.

Os testes usam dados e chave fictícios, sem executar APIs pagas. R92 e testes reais Luna/Terra relatados anteriormente não são repetidos. R95–R196 não estão comprovadamente instalados na VPS.

**REVIEW ONLY:** nenhuma alteração de `main`, mascote, site público ou `publicFaiscaEnabled=false`; nenhum deploy/merge, Portal/Sites/CRM, DNS, lead, ticket ou cobrança. Exigir CI da HEAD exata e revisão independente AppSec/LGPD/FinOps/editorial antes de qualquer homologação operacional e sem GO público.
