# Faísca R19 — alerta consultivo de compatibilidade entre objetivo e serviço

**Base:** R18, PR #481. **Escopo:** laboratório de qualificação R08; sem contratação, CRM, PSP, Portal operacional ou IA externa.

## Problema

Um visitante pode confirmar **Site Onepage** e depois informar como objetivo **captar contatos**, ou confirmar **Landing Page** e depois informar que precisa **apresentar a empresa**. A jornada R08 respeita corretamente a escolha, mas ao final não oferece nenhuma oportunidade de reconsideração. O Faísca deve ajudar a comparar antes de compartilhar o resumo ou solicitar uma proposta, sem alterar arbitrariamente uma decisão do cliente.

## Implementação

`ops/faisca/qualification/service-fit.mjs` introduz `faisca.service-fit.review.v1`, um **alerta editorial conservador**, não um modelo de scoring. Somente perfis R08 confiáveis, enumerados e completos podem produzir um resultado.

Dois casos definidos:

| Escolha confirmada | Objetivo declarado | Alternativa para revisar |
| --- | --- | --- |
| Site Onepage | Captar contatos | Landing Page |
| Landing Page | Apresentar a empresa | Site Onepage |

A orientação diz apenas que **vale comparar** a alternativa; não informa que uma solução é superior, não garante resultados, não cria pedido e **não muda a seleção**. Não existe recomendação automática para objetivos indefinidos, vendas online e outros casos que exigem análise humana.

A informação aparece na etapa **Como avançar?** da R17, que já permite reabrir o seletor de serviço. Troca real de escolha no laboratório continua exigindo confirmação explícita do visitante. A R18 segue mostrando a disponibilidade atual do checkout público, obtida da política F348.

## Contrato e limites

O alerta contém apenas `selectedService`, `status`, `alternativeService` e texto fixo revisável. `reviewOnly=true`, `selectionChanged=false`, `orderCreated=false`, `contactCollected=false`, `operationalEffects=false`. Não armazena conversa, score, contato, empresa, valor, histórico de visita ou informação de cliente real.

## Testes

`tests/faisca-r19-service-fit.test.mjs` cobre:
- os dois alertas conservadores;
- objetivos que **não** recebem indicação automática;
- rejeição de perfis forjados/incompletos/getters;
- manutenção da escolha e da preferência de contato;
- confirmação da troca como ação independente;
- manutenção de `publicCheckoutAuthorized=false`.

O teste Chromium R08 confirma uma recomendação contextual derivada do objetivo do visitante, sem permitir envio de lead nem abertura de checkout.

```bash
node --test tests/faisca-r19-service-fit.test.mjs tests/faisca-r18-portal-readiness.test.mjs tests/faisca-r17-next-step.test.mjs
npm test
```

**Aceite:** CI verde na SHA exata, revisão independente e revisão editorial antes de qualquer ativação comercial. Nenhum custo, cliente real, alteração do mascote, deploy, merge, DNS, VPS ou operação financeira.
