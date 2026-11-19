# Faísca R82 — reserva durável local de gastos estimados (LAB / DRAFT)

**Base fixa:** R81 #554 HEAD `9fb7699e4ac831bf67ee4db0d1c52eb97afae99b`. Dependências R80 #553, R79 #552, R78 #551, R72 #544 e cadeia R51–R77. PR draft isolada, sem alterar main, mascote ou arquivos públicos. `publicFaiscaEnabled=false`.

## Problema e implementação
R81 impunha limite por processo (100 chamadas, US$10 estimados), que reiniciava com cada CLI/servidor. R82 cria um livro de reservas persistente **por host e diretório** compartilhado pelas CLIs privadas. Cada chamada Luna/Terra reserva uma estimativa antes da rede. Reservas não são devolvidas após timeout/erro. Quando o limite se esgota, a requisição à API não acontece.

- Módulo `ops/faisca/openai/durable-reservation-ledger.mjs`: lock exclusivo no mesmo host, diretório real de propriedade do operador com permissões 0700, livro 0600 sem dados pessoais, escrita temporária + fsync + rename, política e contadores íntegros; recusa lock preso, mudança de política, corrupção e diretório inseguro. Não há desbloqueio automático pós-crash.
- `live-lab.mjs`: opção injetada de reserva durável antes da chamada, sem alterar o default dos testes R72/R81.
- Ambas as CLIs privadas R81 passam a exigir `FAISCA_PRIVATE_LEDGER_DIR`; sem ela não podem fazer chamadas pagas.
- `tests/faisca-r82-durable-ledger.test.mjs`: persistência entre clientes, exclusão concorrente, limites por solicitações e valor, segurança de diretório/symlink/lock e não disparo de API após erro ou esgotamento.

## Preparo somente no host de desenvolvimento autorizado
Provisionar uma única vez, por usuário operacional, diretório privado **persistente e local**, fora do repositório e de diretórios efêmeros:

```bash
install -d -m 0700 "$HOME/.local/share/faisca-private-reservations"
export FAISCA_PRIVATE_LEDGER_DIR="$HOME/.local/share/faisca-private-reservations"
```

Usar o MESMO caminho absoluto em terminal e navegador do mesmo host. Manter os demais opt-ins de R81 e credenciais apenas no cofre/ambiente privado já autorizado. Não publicar ou exportar chaves. Não mudar diretório para contornar a cota. Após crash, inspecionar processos, lock e livro e conciliar Usage/Billing antes de qualquer reparo; nunca apagar o lock automaticamente. O livro não tem resets automáticos.

## Limitações e revisão independente
**Não é hard stop de fatura nem quota distribuída.** Os valores são estimativas com preços embutidos, que podem mudar. Cobre só processos que usam o mesmo diretório e host com semântica POSIX de lock/fsync; não cobre outras credenciais/processos/servidores. Requer controle transacional central e limites oficiais do projeto para staging futuro, revisão de tarifas/Usage, AppSec, LGPD e fundamentação editorial.

Os testes são sintéticos. Permanecem bloqueados publicação, integração CRM/Portal operacional, contratação Onepage sem login/autoridade/aceite/recibo, dados reais, deploy, alteração de VPS/DNS, merge e cobrança.

## Testes
```bash
node --test tests/faisca-r82-durable-ledger.test.mjs
node --test tests/faisca-r81-extended-paid-session.test.mjs tests/faisca-r72-openai-live-lab.test.mjs
node --test tests/faisca-*.test.mjs
```

Revisão independente pendente: segurança de locks/TOCTOU, crash após rename, política de retries, diferenças entre valor estimado e Usage real, falso positivo editorial, separação por host/tenant, staging privado e autorização humana específica para operação.