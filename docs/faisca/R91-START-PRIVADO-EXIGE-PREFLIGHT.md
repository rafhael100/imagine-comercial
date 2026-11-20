# Faísca R91 — preflight obrigatório no início do servidor privado

Base: R89 #563 (`f65454f11a988596a06d32f62b3f9c28b195ccbf`), dependente da R86 staging #561. Trilha paralela R87 → R88 → R90 ainda deve ser composta em revisão independente.

## Problema real
O CLI R86 oferecia inspeção segura, porém a entrada `scripts/faisca-openai-private-review-server.mjs` **não exigia** que ela tivesse sido executada. Isso permitia iniciar a sessão privada com ledger corrompido ou exaurido e com HEAD não verificada, desde que o operador tivesse variáveis de ambiente.

## Correção
- O entrypoint de API privada exige agora, *antes* de criar o serviço, `inspectFaiscaPrivateStaging({ expectedHead: process.env.FAISCA_STAGING_REVIEW_SHA })` com `READY_FOR_PRIVATE_OPERATOR_START`.
- O SHA deve ser **copiado de forma independente da PR revisada**, nunca obtido automaticamente do próprio checkout.
- Ele recusa CI, SHA divergente, árvore rastreada suja, segredo/token ausente ou incorreto, ledger inseguro, esgotado ou corrompido, lock residual e porta loopback ocupada.
- Mensagens de erro são neutras; o operador deve rodar o CLI de diagnóstico R86 para ver apenas os códigos de falha. Ajuste do log para refletir que GET HTML/JS/CSS está disponível *somente* na interface privada, enquanto POST exige bearer.
- Testes Node lançam o **entrypoint real** em processos filhos isolados com PIN ausente ou falso; não exportam segredos, não chamam modelos, não criam ledger nem serviço.

## Executar em CI / operador
```sh
node --test tests/faisca-r91-private-start-mandatory-preflight.test.mjs
node --test tests/faisca-r89-staging-ledger-readiness.test.mjs
```

No checkout de staging autorizado: `export FAISCA_STAGING_REVIEW_SHA=...` com SHA completa revisada da PR, executar o CLI de preflight e *depois* o servidor; o servidor refaz o gate. Não editar o pin para resolver uma divergência. A checagem pontual de disponibilidade da porta tem uma pequena janela de corrida e não equivale a isolamento de host ou evidência de acesso real à VPS.

Não há deploy, merge, DNS, alterações VPS, credenciais reais, dados de clientes, chamadas faturadas ou ativação do Faísca público; `publicFaiscaEnabled=false`. Revisão de AppSec/FinOps, QA privada e autorização operacional humana continuam obrigatórias.
