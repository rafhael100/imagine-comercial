# Faísca R195 — prazo HTTP independente e barreira durável

A R194 passou a registrar resultado **incerto de entrega HTTP** também quando a requisição ao provedor não falhou. A R195 exercita o segundo caminho de risco: a camada HTTP encerra a espera antes de o adaptador de modelo retornar, e o transporte de fixture **ignora** `AbortSignal`.

O teste `node --test tests/faisca-r195-http-deadline-durable-fence.test.mjs` confirma em HTTP real de loopback que há apenas uma reserva e um único despacho simulado, que a primeira resposta é 503 opaca e que o encerramento ordenado grava o marcador NO-START. Depois reinicia o servidor, adaptador e ledger sobre o mesmo diretório, exige 503 sem novas requisições e impede reset de quota.

Não comprova a origem do consumo nem a entrega de respostas no OpenAI real. Não constitui trava totalmente atômica contra morte súbita antes do fsync nem resolve chamadas já em trânsito em outros processos/hosts. Exige conciliação independente, revisão AppSec/LGPD/FinOps/editorial e homologação na VPS por operador antes de qualquer GO. Não executar com chave, mensagens reais ou rede de produção em CI. O relatório é estritamente **REVIEW-ONLY**, com `publicFaiscaEnabled=false`, sem alteração de main/site/mascote, merge, deploy ou efeitos Portal/CRM/Sites.
