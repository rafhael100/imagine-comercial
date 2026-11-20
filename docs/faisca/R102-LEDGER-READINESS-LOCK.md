# Faísca R102 — prontidão não pode ignorar lock remanescente

**Base independente:** R100 #575 `edfef3151805861908a87fcbc0620ee61d69f221`. A R101 #576 está em branch paralela e altera outro arquivo; nenhuma é integrada automaticamente à `main`.

## Falha e correção

O preflight de VPS R86 já verificava separadamente a presença de `.faisca-reservations.lock`, mas a API pública do ledger `ready()` retornava `true` após ler estado/capacidade, mesmo quando um lock remanescente de crash impedia `reserve()`. Um caller futuro que utilizasse `ready()` sem repetir a verificação especial da VPS poderia interpretar esse falso positivo como prontidão do teste pago.

`ready()` agora verifica o lock via `lstat`, sem seguir symlink, sem remover o arquivo e recusando erros de inspeção. Tanto `ready()` simples quanto `ready({requireCapacity:true})` falham quando há lock. O ledger continua com lock `O_EXCL` atômico em cada reserva, pois a sondagem de prontidão **não** elimina corridas entre processos. A detecção de lock é defesa em profundidade, não reparação automática de crash.

## Prova executável

`node --test tests/faisca-r102-ledger-crash-lock-readiness.test.mjs tests/faisca-r100-ledger-initialization-marker.test.mjs tests/faisca-r84-multiprocess-ledger.test.mjs`

Testa estado já consumido com lock remanescente, NO-START no preflight privado, ausência de exclusão/modificação automática, symlink, reinício simulado, recuperação manual de fixture, e diretório novo desbloqueado sem side effects. Não usa rede externa ou crédito pago.

## Gates

- Executar CI completa na HEAD exata R102 (Node/HTTP/Chromium/axe, Portal Onepage fixado, PHP, PostgreSQL descartável, Comercial/SEO).
- Revisão independente de AppSec/concor­rência e procedimento humano para analisar locks após crash; **não** remover locks da VPS automaticamente.
- Homologação privada de R95–R102 só com operador autorizado e SHA revisada; a homologação relatada R92 não compreende essas versões.
- `publicFaiscaEnabled=false`; sem alterar mascote, site público, `main`, VPS/DNS, credenciais, modelos reais, dados reais, CRM/Portal operacional, leads, tickets ou cobranças.
