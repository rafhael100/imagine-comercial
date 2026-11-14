# PERF-CALC F311 — transparência da ativação e da gestão no simulador

## Regras comerciais incorporadas

- **Ativação inicial (uma vez): R$ 490 por canal escolhido.**
  Exemplo: um canal R$ 490, dois R$ 980, três R$ 1.470. Não é uma
  mensalidade e não é o mínimo mensal de gestão.
- **Investimento em mídia:** o visitante escolhe canais; pisos de planejamento
  Meta R$ 700, Google R$ 1.000 e ChatGPT R$ 1.200; referências de partida
  R$ 1.000, R$ 1.500 e R$ 1.800, respectivamente. A mídia será paga
  diretamente às plataformas, não à Imagine.
- **Gestão mensal:** 20% do gasto de mídia efetivamente verificado depois
  da competência, com a cobrança separada. Na calculadora, 20% da
  verba **sugerida** é somente uma estimativa.
- **Mínimo mensal de gestão:** há previsão comercial de mínimo aplicável
  quando a remuneração percentual não o alcança, mas **o valor exato não
  está homologado nesta entrega**. Não inferir R$ 490 mensais a partir
  da taxa única de ativação. A proposta formal do Portal precisa definir
  e versionar o mínimo antes de preços contratuais e checkout.
- **Sem cobrança:** esta entrega não gera campanha, pedido de contratação,
  fatura, lead, transação Asaas ou instruções de API Ads.

## O que a interface apresenta

A tela de resultado mostra, separadamente:
1. mínimo e verba sugerida em mídia;
2. 20% de gestão **de referência**, ainda sem mínimo mensal definido;
3. subtotal mensal ilustrativo (mídia + 20%, sem o mínimo contratual);
4. ativação única de R$ 490 multiplicada pelos canais;
5. subtotal ilustrativo do primeiro ciclo (mídia + 20% + ativação, ainda
   **sem** o possível mínimo mensal).

Assim, `illustrativeFirstCycleSubtotalCents` e
`illustrativeTotalCents` **não constituem cotação final nem preço
contratual**. Não usar esses valores como total a cobrar no Asaas.

Exemplos com a referência inicial e sem CPL:
- **Meta:** R$ 1.000 de mídia + R$ 200 de gestão estimada + R$ 490
  de ativação = **R$ 1.690** de subtotal inicial ilustrativo.
- **Três canais:** R$ 4.300 de mídia + R$ 860 de gestão estimada +
  R$ 1.470 de ativação = **R$ 6.630** de subtotal inicial ilustrativo.

## Gates para liberação comercial

Exigir versão assinada/compatível do catálogo financeiro do Portal,
revisão das regras de ativação e recorrência, valor preciso de mínimo
mensal homologado e consentimento/contratação formal. Até lá, a
calculadora continua **informativa** e isolada do CRM e dos gateways.

**DRAFT / NO-MERGE / NO-DEPLOY / NO-CHARGE.**
