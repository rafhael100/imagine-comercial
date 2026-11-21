# R194 — perda de entrega HTTP privada e bloqueio durável

## Problema tratado

R191 registra em disco o resultado **incerto do provedor**. Mas um cliente HTTP privado pode interromper a conexão ou ultrapassar o prazo local **após uma reserva e despacho já realizados**, mesmo que o provedor acabe respondendo com sucesso. A barreira HTTP R121/R107 recusava novas solicitações no mesmo processo; uma nova instância, porém, poderia voltar a despachar sob as reservas remanescentes.

## Incremento

- O adaptador Luna/Terra disponibiliza `markDeliveryUncertain()`, que bloqueia imediatamente novas chamadas no processo e utiliza o marcador durável de incerteza R191 quando o ledger está presente.
- O HTTP chama essa proteção ao observar entrega perdida, prazo local vencido ou exceção com possível despacho, sem expor token, pergunta ou resposta. O encerramento normal do servidor aguarda a persistência pendente.
- Testes usam Node HTTP real em loopback, requisição interrompida de propósito, modelo simulado que **retorna sucesso depois da desconexão**, marcador persistido, reinício de instância/ledger e ausência de novo despacho. Também exercitam idempotência e chamada direta ao adaptador.
- `node --test tests/faisca-r194-http-delivery-durable-fence.test.mjs`.

## Limites de segurança

É uma melhoria para desconexão com **encerramento ordenado**, não um lock crash-atomic do intervalo completo da chamada. Desligamento abrupto do host antes do fsync, duas chamadas de processos já iniciadas e verificação independente do consumo continuam exigindo controles adicionais e revisão do operador. Erros de gravação não são expostos nem reabrem o processo; não é seguro presumir persistência sem verificar o marcador.

Sem alteração de main/site público/mascote, sem credenciais, API paga, deploy, VPS, DNS, CRM/Portal/Sites, atendimento real ou GO público. A homologação R92 relatada e os testes pagos anteriores não foram repetidos. `publicFaiscaEnabled=false`.
