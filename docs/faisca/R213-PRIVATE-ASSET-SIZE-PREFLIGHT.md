# Faísca R213 — preflight rápido do orçamento de bytes dos assets privados

**Base selecionada:** R212 #690 (branch draft), sem alteração em `main`, no site comercial ou no mascote aprovado.

## Causa observada

A primeira CI da R212 retornou 40 testes de smoke R94/R95/R113–R193 bloqueados pelo mesmo problema: o JavaScript privado cresceu até ultrapassar o limite rígido de 24 KiB. O código foi reduzido na R212 sem elevar o limite; o teste completo em Node só indicava o problema indiretamente em vários cenários.

## Novo gate executável

- `ops/faisca/openai/private-asset-size-gate.mjs` mede bytes reais UTF-8 dos HTMLs normal e de conversa, JS e CSS **antes** da suíte demorada.
- Em caso de asset maior que 24.576 bytes, encerra a CI na etapa inicial com nome de asset e tamanho, sem aceitar aumento silencioso do teto. Não lê segredos, não inicia servidor, não faz requisições.
- `.github/workflows/faisca-guided-lab.yml` executa `node ops/faisca/openai/private-asset-size-gate.mjs --verify` após configurar Node e antes dos 900+ testes.
- Um teste Node adicional prova limite exato, medição multibyte e rejeição de entradas inválidas. O smoke HTTP byte a byte e sua política CSP continuam obrigatórios; este preflight não os substitui.

## Gates que permanecem fechados

- [ ] CI da HEAD exata: Node/HTTP, Chromium/axe/WCAG, PostgreSQL efêmero, PHP, Onepage/Portal e Comercial/SEO.
- [ ] AppSec/LGPD/editorial/FinOps, conciliação de consumo e homologação acumulada em staging privado.
- [ ] Decisão operacional humana separada para qualquer instalação. Sem GO público.

Apenas fixtures, código privado e CI. Sem chaves, chamadas pagas, dados reais, deploy, merge, DNS, VPS, CRM/Portal/Sites ou cobrança. `publicFaiscaEnabled=false` é preservado.
