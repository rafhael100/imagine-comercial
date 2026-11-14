# F320 — mínimo mensal aprovado na calculadora PT/EN/ES (revisão, não publicação)

## Decisão comercial vinculante — 14/11/2026
Conforme as decisões registradas na PR [#375](https://github.com/rafhael100/imagine-comercial/pull/375):
- **Ativação única:** R$ 490 por canal contratado, separada da mídia e da gestão.
- **Mídia:** paga diretamente pelo cliente à Meta/Google ou à plataforma efetivamente habilitada; nunca fingir que o site já ativou anúncios no ChatGPT.
- **Gestão pós-paga:** para um **mês civil completo**, cada canal contratado tem gestão igual ao maior valor entre **20% da mídia efetivamente investida** e **R$ 170 por mês**. Os mínimos não se compensam entre canais.
- A apuração real exige dado verificado de cada canal; gasto ausente não significa gasto zero. Primeiro/último mês parcial e pausas carecem de regra própria, sem prorrata presumida.
- Novas regras não reclassificam cobranças e pedidos antigos.

## Implementação somente ilustrativa
A função `illustrateFullMonthManagementCents(spendCents)` opera em centavos inteiros, rejeita entradas inválidas e **não emite cobranças**. O estudo agrega as taxas **por canal** (e não 20% do somatório sujeito a um piso único).
| Canal | Mídia mínima comercial | Gestão se apenas mínimo de mídia |
| --- | ---: | ---: |
| Meta Ads | R$ 700 | R$ 170 (20% = R$ 140) |
| Google Ads | R$ 1.000 | R$ 200 |
| ChatGPT Ads (estudo editorial, sem checkout) | R$ 1.200 | R$ 240 |
| **Total ilustrativo** | **R$ 2.900** | **R$ 610** |

Recomendado de mídia: Meta R$ 1.000 + Google R$ 1.500 + ChatGPT R$ 1.800 = R$ 4.300. Gestão ilustrativa nesse cenário: R$ 860. Ativação hipotética: R$ 1.470 (três canais). **Total econômico hipotético** do primeiro ciclo: R$ 6.630, mas não representa uma fatura: mídia vai aos provedores, ativação é única e gestão é cobrada posteriormente; ChatGPT Ads permanece não habilitado para contratação.

## Proteções
- Nenhum formulário de dados pessoais, pedido, endpoint, e-mail, pixel, evento de marketing, CRM write, gateway ou checkout público foi adicionado.
- O texto e o resultado em PT, EN e ES distinguem taxa de ativação, mídia e gestão, incluindo regra de R$ 170 por canal.
- O botão WhatsApp continua enviando apenas combinação de canais, sem valores ou dados pessoais.
- Os testes de `tests/media-budget-calculator.test.mjs` cobrem R$ 0, R$ 350, R$ 850 e R$ 4.000 por canal e composição multi-canal; `scripts/test-calculator-browser-ci.mjs` cobre as três versões em Chromium local.
- A função de cálculo não autoriza faturamento quando o spend é desconhecido ou período parcial; sistemas de fechamento requerem contratos/gates específicos.

## Gates
**DRAFT / REVIEW ONLY / NO-MERGE / NO-DEPLOY / NO-BILL / NO-ADS / NO-CRM-WRITE.** A branch parte da HEAD fixa da PR #401, mantendo 63 páginas, 27 URLs legadas sob política HOLD, os artefatos privados e os demais controles. Testes locais e CI são necessários e insuficientes para GO operacional.