# Faísca R30 — convergência da candidata R27/R29 sem alterar o produto

**Origem:** R29 [#493](https://github.com/rafhael100/imagine-comercial/pull/493) com cinco workflows de CI aprovados; R27 [#491](https://github.com/rafhael100/imagine-comercial/pull/491) com cinco workflows aprovados.  
**Status:** revisão de integração; nenhuma publicação operacional.

## Por que existe

A R28 foi iniciada antes das duas últimas correções de CI da R27. Os arquivos finais de teste da R27 já tinham sido transportados para as R28/R29, com **o mesmo blob Git SHA `628b154f669f15aa90bea7ff91e4c99b4c95d9b0`**, mas o Git mostrava a R27 final dois commits atrás da R29.

A lacuna de ancestralidade poderia causar confusão ao revisar e empilhar PRs. A R30 reconcilia o histórico sem sobrescrever a entrega do Comercial, o pacote portátil ou o mascote.

## Reconciliação executada

Criada a branch `integration/faisca-r30-reconcile-r27-r29-2026-11-19`, com commit de merge:

- SHA do merge: `2ef7604f4555403cd0b146a6baa65db9db008305`;
- primeiro pai: R29 final `99d35770d6a4ba20a4e3e9da2398b95a15eb59ea`;
- segundo pai: R27 final `168c7ca960292144018adaf75cc89383c268cc56`;
- árvore Git: `865e260a12b7954d0a495ebbae4c19300a7e83ff`, idêntica à árvore da R29 antes da adição dos testes/documentação desta PR;
- comparação oficial `R27...merge`: `behind_by=0`;
- comparação `R29...merge`: **zero arquivos diferentes**.

A PR R28 continua contendo os ajustes F357 portados de sua branch paralela, sem declarar um merge da F357 inteira. Esse trabalho comercial requer reconciliação própria antes de promoção de release.

## Testes R30

`tests/faisca-r30-final-candidate-guards.test.mjs` confirma:

1. Faísca público desativado e checkout/redirect/charge não autorizados.
2. Privacidade preservada durante uma troca de serviço pendente (sem ecoar senha).
3. WhatsApp F357 derivado do catálogo público único em PT-BR/EN/ES.
4. O lançamento portátil requer senha válida e o PNG aprovado permanece byte-identical.

O workflow completo deve passar **na SHA final desta PR**, incluindo laboratório R29 portátil no Chromium, R27 sem JS, R26 não-vazamento no dist público, R06/PHP, SEO e PostgreSQL. Não herdar resultados de SHAs anteriores para aprovar o R30.

## Estado de produto

A cadeia R02–R30 constitui um **candidato de revisão privada de alta cobertura**, não um Faísca operacional em produção:

- GUI e vendas: simuladas localmente; formulário real, checkout e suporte autenticado não ativados.
- IA: contrato de roteamento/grounding e testes com PHP, mas nenhum modelo externo/credencial contratado.
- Portal/CRM: integração operacional pendente, com identidade/empresa/consentimento/recibos, RLS e PSP.
- Infraestrutura: staging HTTPS Leaseweb, IAM, backup/restauração e rollback ainda exigem provas reais.
- Publicação: o `imagine-comercial/main` não foi alterado; todas as PRs seguem em draft e requerem revisão independente, reconciliação do Comercial P0 e GO específico.

Nenhuma configuração de DNS, VPS, cobrança, segredo, dado de cliente, alteração do mascote ou merge em main foi realizada.
