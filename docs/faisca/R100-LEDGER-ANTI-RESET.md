# Faísca R100 — impedir reinicialização silenciosa do saldo privado

Base R99 #574, somente revisão; nunca rodar este código diretamente no ledger operacional antes de revisão e homologação.

## Defeito

O ledger privado durável R82–R93 tratava um arquivo `faisca-reservations.json` ausente como uma instalação nova com zero chamadas e zero gasto estimado. Se o estado sumisse após consumir créditos, um reinício poderia renovar o limite automaticamente sem pré-aviso. A pasta 0700 reduz acesso de terceiros, mas não protege contra exclusão acidental ou erro operacional.

## Correção fail-closed

- Um marcador independente `.faisca-reservations-initialized` (0600) é criado **sob o mesmo lock exclusivo** e sincronizado no disco **antes** da primeira atualização do arquivo de estado.
- Marcador presente com estado ausente, truncado, adulterado ou inseguro bloqueia `ready()` e `reserve()`, inclusive após reiniciar o processo.
- Falha entre criar o marcador e persistir a primeira reserva bloqueia a próxima execução, ao invés de inventar saldo novo.
- Arquivos legados íntegros sem marcador continuam lendo o saldo antigo, e ganham marcador na próxima reserva atômica. Portanto a migração não zera nem amplia cotas existentes.
- A remoção deliberada de **ambos** os arquivos por quem controla a pasta, a alteração de estado e uma quota em múltiplos hosts **não** são evitadas. Não é bloqueador oficial do faturamento OpenAI.

## Provas e gates

`node --test tests/faisca-r100-ledger-initialization-marker.test.mjs tests/faisca-r82-durable-ledger.test.mjs tests/faisca-r84-multiprocess-ledger.test.mjs tests/faisca-r89-staging-ledger-readiness.test.mjs`.

Os testes são exclusivamente em pastas temporárias próprias com dados sintéticos: primeira inicialização, exclusão do estado após consumo, upgrade legado sem alterar saldo, arquivo de marcador truncado/inseguro/symlink. CI deve confirmar a suíte completa na HEAD exata, além de Chromium/axe, PHP, PostgreSQL descartável, compatibilidade Onepage e SEO.

**Antes de levar à VPS:** revisão independente de segurança e durabilidade (atomicidade, fsync, backups, tratamento de crash), confirmação de identidade/permissão local e preservação de eventual estado R92 já utilizado. Uma pasta nova é um novo ledger deliberado; não migrar nem apagar arquivos automaticamente. O agente não acessou a VPS e não usou chaves/créditos.

`publicFaiscaEnabled=false`, mascote, site público e `main` inalterados; sem merge, deploy, DNS/VPS, dados reais, leads, tickets, CRM/Portal operacional ou cobranças. Evidência sintética não libera produção.
