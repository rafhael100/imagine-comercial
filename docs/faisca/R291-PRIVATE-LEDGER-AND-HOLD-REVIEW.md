# Faísca R291 — envelope conservador de inspeção de ledger e travas

**Base exata:** R290 #770, commit `615e5f8c5ea22cde829b6db126642a8406ea42b1`. Branch isolada e PR draft. Não altera `main`, serviços públicos, mascote, DNS ou VPS.

## O que foi implementado

Relatório único, local e somente leitura, que combina o diagnóstico R290 das três travas duráveis (reserva, despacho em andamento e resultado incerto) com a leitura validada do ledger e sua testemunha high-water R82–R289. Inspeciona duas vezes as travas e a presença dos dois marcadores de inicialização para detectar mudanças simples durante a consulta. Se houver alteração observada, não emite relatório.

O estado do ledger possui **três resultados possíveis**: `readable_non_atomic` quando os dois marcadores existem e o ledger é legível, `manual_review_required` quando a leitura falha (inclusive lock, corrupção ou rollback), ou `uninitialized_or_legacy_requires_review` quando os marcadores de inicialização estão ausentes. Nos dois últimos casos, números de reserva são `null`, **nunca zero presumido**.

Mesmo em leitura válida e sem travas, o relatório apresenta `canStartPaidCalls=false`, `canReleaseDurableFence=false`, `canResetQuota=false`, `providerUsageReconciled=false`, `stagingInstallationVerified=false` e `publicReady=false`. É observação não atômica, local e não autorizadora. Não lê mensagens nem chaves, não acessa API OpenAI e não modifica arquivos.

## Uso autorizado somente em checkout privado do operador

Diretório absoluto, normalizado, de propriedade exclusiva do processo e modo 0700, com limites idênticos aos do ledger. Não executar em CI, VPS operacional sem autorização independente ou produção:

```sh
FAISCA_PRIVATE_LEDGER_COMBINED_REVIEW=REVIEW_ONLY \
  node scripts/faisca-private-combined-ledger-review.mjs \
  --directory=/diretorio/privado/0700 --max-requests=4 --max-budget-usd=1
```

A CLI não aceita dados pessoais, saída de mensagens, credenciais, endpoints nem arquivos de relatório. Ela retorna apenas flags e contadores tipados; erros são redigidos genericamente, sem caminho local ou conteúdo. Para rodar as fixtures sintéticas:

```sh
node --test tests/faisca-r291-private-combined-ledger-review.test.mjs
```

Os testes cobrem inicialização ausente, reservas fsynced, alteração das travas, symlink pendente, lock de crash, corrupção de high-water, ausência da habilitação administrativa, CI e permissões inadequadas, além da preservação byte a byte após inspeção.

## Bloqueios mantidos

Esta prova **não** é confirmação de instalação R95–R291 no staging Docker/PID/HTTP e não representa consumo oficial conciliado com a OpenAI. A homologação R92 e o teste pago Luna/Terra relatados pelo usuário não foram refeitos. Requer inspeção independente do ambiente implantado, conciliação oficial FinOps e revisões AppSec/LGPD/editorial antes de qualquer GO público. Nenhuma operação Portal/Sites/CRM, cobrança, lead, ticket, deploy ou merge é autorizada.
