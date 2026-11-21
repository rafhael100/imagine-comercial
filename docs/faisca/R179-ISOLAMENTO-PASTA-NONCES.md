# Faísca R179 — isolamento do diretório anti-replay (DRAFT / NO-GO)

## Correção preventiva

R177 adicionou consumo de nonce persistente após a última verificação Git/evidência; R178 comprovou a CLI em checkout temporário. Uma configuração incorreta poderia, entretanto, apontar a pasta de nonces para dentro do checkout ou dos arquivos da auditoria, criando um registro após a última verificação e invalidando a premissa de isolamento.

R179 acrescenta um gate **antes da leitura das evidências**, exigindo que o diretório do nonce seja um caminho absoluto/canônico e que não seja igual, descendente nem ancestral do checkout Git ou do diretório de extratos. Nomes que apenas compartilham prefixo textual não são confundidos com o mesmo diretório. O verificador físico R177 continua exigindo 0700, dono do operador, O_NOFOLLOW, criação exclusiva, arquivo 0600 e fsync.

Testes de módulo e da **CLI real** R178 em checkout descartável rejeitam registry dentro de checkout, evidência, subpastas e ancestral comum. Nenhum marcador é gravado no cenário recusado, e nenhum caminho/nonce aparece no stderr.

Este gate é uma verificação lexical de topologia, complementada pelas provas POSIX reais de R177; não substitui ACLs, isolamento do host, custódia independente do nonce, provider-attestation, retenção, backup, conciliação de faturamento, staging R95+ ou revisão AppSec/LGPD/FinOps/editorial. Nenhum GO público é inferido.

Comandos sintéticos: node --test tests/faisca-r177-private-signed-review-replay.test.mjs tests/faisca-r178-private-signed-operator-e2e.test.mjs tests/faisca-r179-private-nonce-location.test.mjs; workflows de CI completos conforme AGENTS.md.

R92 e chamadas pagas Luna/Terra anteriores não foram repetidas. Sem segredos, dados reais, cobrança, leads, tickets, merge/deploy ou VPS/DNS. main, site público, mascote e publicFaiscaEnabled=false permanecem preservados.
