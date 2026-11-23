# R290 — diagnóstico local dos marcadores NO-START, apenas leitura

**Base:** R289 #769, a partir da HEAD `0ce7c47301b087541b9462992edc7b403df02b3e`, com R288 #768 e a cadeia R95 preservadas. PR empilhada DRAFT, sem alteração de produção.

## Finalidade

O operador pode examinar **somente a presença** de três marcadores do ledger R82–R289: trava de reserva, despacho de provedor em andamento e resultado de provedor incerto. Uma entrada presente, mesmo symlink quebrado ou escrita interrompida, indica bloqueio; a rotina usa `lstat`, não segue links, não lê o conteúdo e não remove arquivos.

Exemplo em checkout privado **independentemente revisado** e diretório local pertencente ao operador com modo 0700:

```sh
FAISCA_PRIVATE_HOLD_INSPECTION=REVIEW_ONLY \
  node scripts/faisca-private-hold-review.mjs \
  --directory=/caminho/absoluto/privado/0700
```

O comando não é executado automaticamente, recusa GitHub Actions e CI, e não acessa Docker, VPS, OpenAI, Portal, Sites, rede externa, tokens, mensagens ou dados pessoais. A saída contém apenas campos booleanos fixos, sem caminhos locais, conteúdos, segredos ou IDs. Qualquer erro de acesso/identidade do diretório bloqueia sem eco de entrada.

**Limite essencial:** a ausência dos três marcadores NÃO é prova de prontidão ou de integridade do ledger, e observações entre processos não são atômicas. O retorno mantém `canStartPaidCalls=false`, `canReleaseDurableFence=false`, `canResetQuota=false`, `providerUsageReconciled=false`, `publicReady=false` e `operationalEffects=false`, mesmo sem marcadores. A decisão sobre retomada cabe ao custódio após inspeção, conciliação independente e revisão AppSec/FinOps/LGPD.

## Validação sintética

```sh
node --test tests/faisca-r290-private-hold-inspection.test.mjs
```

O E2E usa subprocessos Node, duas reservas sintéticas realmente fsynced em pasta temporária 0700, um lock fictício, symlink de despacho quebrado e marcador de incerteza. Confere saída sem paths, bloqueio de permissões inseguras e integridade byte a byte dos arquivos após cada inspeção. Os workflows Node/HTTP, Chromium/axe/WCAG, SEO/build, Onepage, PostgreSQL efêmero e PHP completam os gates de laboratório.

Sem chamada paga nova, sem token/chave ou dados reais, sem revisão de receitas operacionais e sem autorização para deploy, merge, DNS ou alteração da VPS. Homologação R92 e testes pagos Luna/Terra relatados pelo usuário são respeitados e não repetidos. `main`, site público, mascote e `publicFaiscaEnabled=false` permanecem inalterados. **NO-GO público.**
