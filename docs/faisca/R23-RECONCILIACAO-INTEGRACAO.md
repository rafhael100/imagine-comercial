# Faísca R23 — reconciliação da ancestralidade R15–R22

**Status:** branch de integração **DRAFT / REVIEW ONLY**, sem publicação, merge na `main`, DNS ou VPS.

## Defeito de integração identificado

O desenvolvimento R16 foi iniciado em uma versão intermediária da R15:

- base original R16: `2f25af478662118c50758329bac337d45b2d5443`;
- R15 final: `bb6420787758f2eb02c37f29eb997131530afae2`;
- os três commits finais da R15 modificaram exclusivamente `ops/faisca/qualification/http-browser-qa.mjs` (correção de espera do DOM após o limite de 40 mensagens, sem alteração do produto).

A R16 incorporou a correção funcional dos testes, e as R17–R22 avançaram a partir dela. As CIs estavam verdes, mas o Git ainda identificava a R15 como **três commits atrás** da R22. Essa divergência pode atrapalhar a composição/integração de PRs empilhadas, embora o código testado tenha retido as proteções.

## Reconciliação executada

Foi criado um commit de reconciliação com **dois pais**, em branch separada:

- pai 1: R22 final `4893c82c2fe3be7bc3f89c56ad666d44e7652486`;
- pai 2: R15 final `bb6420787758f2eb02c37f29eb997131530afae2`;
- merge de integração: `8d99cf89161268450ef5e972c03343c2bea4ff8a`;
- árvore SHA-1 do Git: `393fa0b2ec6d4eb2869fb7587650983908029677`, **idêntica à árvore da R22 antes de adicionar os testes/documentação desta PR**.

A comparação oficial GitHub de R15 final até o commit reconciliado apresentou `behind_by=0`; a comparação de R22 final até o mesmo commit apresentou **zero arquivos diferentes**. A R15 não perdeu a correção e a R22 não teve código alterado pelo commit de reconciliação.

Foi preservada a evidência funcional:
- `qualification/journey.mjs`: entradas livres descartadas enquanto mudança de serviço aguarda confirmação;
- `lab/http-client.mjs`: ações de confirmar/cancelar mantidas após bloqueio de dados pessoais, sem envio desses dados;
- `qualification/http-browser-qa.mjs`: troca/cancelamento e a espera pelo novo nó DOM após 40 mensagens;
- R17–R22: comparação por PHP em laboratório, resumo, gate de checkout, pacote e iniciador local.

## Nova regressão de segurança

`tests/faisca-r23-release-safety.test.mjs` verifica, em execução Node, que permanecem:
- o modo público Faísca **desativado**;
- o mascaramento de senha e a manutenção da escolha até ação explícita;
- os controles de cancelamento e confirmação no navegador;
- o PNG aprovado com SHA-256 `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`;
- o checkout público proibido e o iniciador de revisão restrito ao loopback;
- nenhuma chamada a provedor de modelo para status privado de cliente.

```bash
node --test tests/faisca-r23-release-safety.test.mjs
npm test
```

Exigir CI da **SHA final desta PR**, em vez de herdar os resultados da R22 ou do commit de reconciliação anterior. Os workflows R05/R06 com PHP, Chromium, PostgreSQL efêmero e Comercial/SEO continuam aplicáveis.

## O que esta entrega NÃO faz

A reconciliação registra a ancestralidade de código já revisado; **não equivale à revisão independente de segurança**, nem integra automaticamente PRs em `main`. O fluxo oficial de login, CRM, checkout, pedidos reais, PSP, atendimento humano e provedor LLM permanece desativado.

A linha de Faísca ainda depende do candidato Comercial e dos gates existentes do Portal. O Portal possui um núcleo Onepage persistente em [#941](https://github.com/rafhael100/imagine-portal/pull/941), mas seu próprio relato limita as provas a bases descartáveis e mantém o serving/deploy e o faturamento reais bloqueados. Não converter aquela evidência em uma URL operacional.

**Próximo aceite:** revisão por responsável independente, reconciliação da candidata Comercial com os demais trabalhos P0, homologação privada autenticada Portal/Sites, privacidade e custos da IA, testes em VPS com backup/restauração e autorização separada de GO para produção.
