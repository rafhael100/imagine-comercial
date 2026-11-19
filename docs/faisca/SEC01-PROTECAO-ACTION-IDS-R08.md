# Faísca SEC-01 — proteção de identificadores de ações da qualificação R08

**Base:** R58 #528 (preparação Onepage), R57 #526, R56 #525 e R55 #523; correção de sincronização HTTP R56 #524 permanece em PR independente. Esta entrega substitui os drafts alternativos #527 e #529, **sem merge**. Laboratório privado, `publicFaiscaEnabled=false`.

## Motivação e preservação de contrato

A qualificação R08 aceita identificadores de ação de tamanho não limitado. A pré-validação rejeita agora valores vazios, acima de 96 caracteres, controle, invisíveis, emoji e caracteres fora do ASCII autorizado. **Preserva letras maiúsculas**, necessárias à escolha legítima `r08:contactConsent:granted`. Não altera a entrada de texto comercial (máximo 800 caracteres), a proteção contra eco livre da R56 #525 nem o encaminhamento Onepage revisado na R58 #528.

## Alterações

- `ops/faisca/qualification/journey.mjs`: aceita `action.id` com 1–96 caracteres ASCII de `[A-Za-z0-9:_.-]`; verifica descritores, sem executar getter nem refletir o valor recusado.
- `tests/faisca-sec01-qualification-action-envelope.test.mjs`: quatro regressões para 100 mil caracteres, NUL, quebra de linha, zero-width, emoji, espaços, caracteres especiais, getters e consentimento, além de fluxo legítimo Onepage e Landing Page.

## Testar e revisar

```sh
node --test tests/faisca-sec01-qualification-action-envelope.test.mjs
node --test tests/faisca-*.test.mjs
npm ci --no-audit --no-fund
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/journey/browser-qa.mjs
```

Exigir CI **na HEAD exata de SEC-01**, com compatibilidade Onepage Portal, Chromium, R56–R58 e revisão independente de privacidade e corretude. Sem autorização para merge, deploy, DNS/VPS, serviços pagos, dados reais, CRM/Portal operacionais, pagamento ou alteração do mascote aprovado.
