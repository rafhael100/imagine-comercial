# Faísca R173 — checkout realmente limpo: recusar flags ocultas no index Git

**REVIEW ONLY / sem GO público.** Base: R172 #650 (subprocessos Git isolados) e R171 #649 (SHA-256 de evidências privadas).

## Problema reproduzido

`git status --porcelain --untracked-files=all` pode ficar vazio mesmo depois de uma alteração de arquivo rastreado se o index tiver `assume-unchanged`; `skip-worktree` também muda o comportamento esperado da inspeção. Isso torna insuficiente o teste de checkout limpo de uma ferramenta sensível que abre evidências numéricas posteriormente.

## Correção

Antes de ler os JSONs privados, a CLI executa `/usr/bin/git -c ... ls-files -v -z` com o mesmo ambiente limitado da R172. Aceita **somente registros NUL-terminados que começam com `H `** (tracked, sem flags especiais). Qualquer `h`, `S`, `s`, entrada truncada, saída excessiva ou erro bloqueia, sem divulgar nomes, caminhos ou dados. O limite é 2 MiB para falhar fechado diante de repositório anormal. A verificação preserva `rev-parse HEAD` e o `status --porcelain` anteriores; não força resets do index ou alterações locais.

Um checkout realmente esparso ou com flags deliberadas permanece em HOLD até revisão humana em clone descartável completo. Um índice adulterado, host comprometido ou uma alteração após a verificação ainda não ficam provados ausentes: não é atestado de integridade da máquina, assinatura da OpenAI ou certificado de faturamento.

## Testes executáveis

```bash
node --test tests/faisca-r173-operator-git-index-proof.test.mjs
node --test tests/faisca-r172-private-operator-git-isolation.test.mjs
node --test tests/faisca-r171-independent-evidence-pins.test.mjs
npm test
```

A fixture Git Linux cria um commit descartável, altera um arquivo rastreado após marcar `assume-unchanged`, demonstra status vazio e confirma a rejeição `h`; testa também `skip-worktree` e a rejeição `S`. Não usa credenciais, dados reais, API ou VPS.

## Gates

Ainda são necessários conciliação independente dos registros da OpenAI, revisão AppSec/LGPD/FinOps/editorial e homologação acumulada R95+ por operador autorizado. Homologação R92 e teste pago anterior permanecem respeitados, sem repetição. Manter `main`, mascote aprovado, site público e `publicFaiscaEnabled=false`; sem merge, deploy, DNS, alteração VPS ou acionamento CRM/Portal/Sites.
