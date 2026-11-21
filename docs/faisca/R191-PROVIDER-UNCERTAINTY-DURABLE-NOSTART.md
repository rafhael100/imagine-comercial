# Faísca R191 — NO-START durável após resultado incerto do provedor

## Lacuna e correção
R187 impede repetição de despachos Luna/Terra na mesma instância após falha da API. R188/R190 bloqueiam reservas com confirmação ambígua. Porém, um **erro no provedor após uma reserva bem-sucedida** podia perder o bloqueio de R187 ao reiniciar o processo, mesmo com saldo restante no ledger.

R191 acrescenta ao ledger de laboratório um marcador persistente `.faisca-provider-outcome-uncertain` no diretório 0700. Ele é criado com O_EXCL/O_NOFOLLOW, modo 0600 e fsync no arquivo e no diretório. A presença do marcador impede `ready()`, `inspectReadOnly()` e `reserve()`, inclusive em novas instâncias/processos. Não há remoção ou recuperação automática. O adaptador chama `markOutcomeUncertain()` somente após falha/timeout/resposta inválida de uma requisição já reservada e despachada; erros não revelam perguntas, chave ou detalhes do armazenamento.

## Prova executável
`node --test tests/faisca-r191-durable-provider-uncertainty.test.mjs`

Cenários: (1) erro sintético HTTP 503 após reserva, marcador fsynced e recusa de um novo adaptador/ledger; (2) duas classificações Luna sintéticas válidas sem marcador; (3) criação idempotente e recusa de marcador symlink/tampered.

## Limites e controles operacionais
- O marcador é uma trava local **após a detecção**. Não impede que outro processo já tenha enviado requisições simultâneas antes da falha, e não substitui um coordenador transacional de múltiplos processos ou hosts.
- Se armazenamento/fsync falhar, o latch em memória permanece ativo, mas a durabilidade não está comprovada. Nenhum operador deve reiniciar sessões pagas até reconciliar as evidências.
- O marcador não comprova valores faturados pela OpenAI. Reconciliação humana independente, AppSec, LGPD, FinOps, revisão editorial e homologação privada acumulada continuam pendentes.
- Não mover/apagar a trava nem reutilizar o diretório para novo teste automaticamente. O operador precisa de análise explícita do gasto antes de qualquer procedimento de recuperação.
- Todas as chamadas no teste são fixtures locais. Testes pagos Luna/Terra e homologação R92 anteriormente informados não foram repetidos. Não há prova de R95+ instalado em VPS/staging.
- Branch e PR draft apenas. **NO-GO público**: `main`, mascote, site público e `publicFaiscaEnabled=false` preservados; nenhum merge, deploy, VPS/DNS, CRM/Portal/Sites operacional, dado real, lead, ticket ou cobrança.
