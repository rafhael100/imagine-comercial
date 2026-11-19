# F52 — Recibos Ed25519 reais em PostgreSQL descartável

Este teste combina a prova criptográfica F45 (chave raiz → política assinada → testemunha Ed25519) com o adaptador F49 executando SQL **contra PostgreSQL real** no runner GitHub-hosted F51. Os pares de chaves são efêmeros e gerados em tempo de CI.

Casos cobertos sem servidor externo:

- Assinatura do recibo adulterada deve falhar antes do banco.
- Política de witness revogada (mesmo assinada pela raiz) deve falhar.
- Versão mínima da política superior à versão recebida deve falhar (anti-rollback).
- Hash de árvore divergente deve falhar sem consumir o nonce.
- Oito verificações paralelas do mesmo recibo, em sessões SQL distintas, têm **exatamente uma aceitação**.
- Uma nova tentativa de replay é rejeitada; o estado persiste entre as conexões enquanto a base de teste existe.
- Os retornos preservam `deploymentAuthorized=false`.

O PostgreSQL local é iniciado e descartado por `scripts/test-postgres-ephemeral-ci.sh`; a migração nunca é aplicada à VPS. Esta prova é mais forte que o transporte simulado da F50, mas **não** certifica a infraestrutura Leaseweb, root registry independente, witness pós-entrega remoto, MFA/grants ou retenção/backups de produção. A homologação privada continua no issue #56. Nenhum deploy, DNS, cliente real ou gasto novo.
