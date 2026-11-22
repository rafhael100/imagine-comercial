# Faísca R225 — auditoria numérica exige duas observações independentes

A comparação de contagens R165 é apenas um **sinal local de divergência**, não conciliação contábil. Dois argumentos apontando para o mesmo objeto mutável não constituem observações independentes de antes/depois; um contador alterado in-place podia aparentar delta zero e produzir `COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW` no caso de pergunta rejeitada.

R225 aplica o capturador imutável e estrito da R224 à auditoria R165: rejeita antes/depois com a mesma identidade de objeto (`BLOCKED_ALIASED_LEDGER_SNAPSHOTS`), getters/accessors e campos não aprovados (`BLOCKED_INVALID_INPUT`). Mantém a comparação de contagem, custo estimado e estados Luna/Terra quando os dois snapshots são distintos e válidos.

Teste executável: `node --test tests/faisca-r225-provider-aggregate-alias.test.mjs`. São quatro cenários sintéticos de aliasing, descritores hostis, rejeição estável e conservação dos limites de custo. Executar junto à suíte Node/HTTP/Chromium/axe e CI do Comercial, sem chamadas pagas ou dados reais.

**Limitações:** nem a independência de objetos nem a igualdade numérica comprovam a fonte de um extrato OpenAI, autenticidade de uma fatura ou isolamento entre processos. Conciliação independente, revisão AppSec/LGPD/FinOps/editorial e instalação operacional acumulada R95–R225 em staging privado permanecem pendentes. Sem credenciais, VPS, DNS, deploy, merge, lead, CRM/Portal/Sites operacional ou GO público; `publicFaiscaEnabled=false`.
