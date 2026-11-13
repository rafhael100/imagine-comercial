# F305 — Reconstrução cumulativa de um catálogo assinado do Portal

## Lacuna corrigida no contrato

O Portal pode publicar **lotes parciais** de alteração. Exemplo: a publicação 2 altera Landing Pages; a publicação 3 altera somente Onepage. Se a compilação usar exclusivamente o último lote, a página de Landing Pages pode voltar ao título/descrição editorial inicial. Isso pode criar diferença entre o catálogo aprovado e o HTML entregue.

A função `reconstructSignedCatalogCheckpointHistory` reconstrói offline uma visão cumulativa de versões assinadas. **Não aplica exclusão quando um slug está ausente de um lote parcial.**

## Contrato de entrada para o laboratório

- `releases`: cadeia ordenada de 2 a 32 registros `{envelope,pin}`; `envelope` é o envelope Ed25519 atual do Portal, `pin` exige `expectedReleaseId` e `expectedPayloadSha256`
- O **primeiro registro precisa conter todos os seis serviços publicados** e os respectivos IDs, slugs, paths e versões; sem ponto inicial completo, a cadeia é recusada
- Cada lote posterior pode alterar apenas os serviços presentes nele; o código recusa versões decrescentes, conteúdo alterado sem incremento, identidade trocada, slug desconhecido, assinaturas inválidas e horários não monotônicos
- A cada alteração, o catálogo efetivo final passa pela revisão de títulos e descrições SEO de todas as seis páginas, incluindo serviços não alterados
- `expectedLatestReleaseId` e `expectedLatestPayloadSha256` fazem o último lote coincidir com a seleção confiável do candidato

## Segurança e integração futura

O resultado inclui `effectiveItems` congelado, adequado para ser **inspecionado no laboratório** e comparado com `mergeApprovedServiceMetadata`. Não modifica `buildServices`, não grava no repositório, não envia para o Portal, não conhece permissões reais e não habilita deploy.

Mesmo com assinaturas válidas, um operador malicioso poderia omitir uma publicação intermediária. Por isso **a cadeia completa e o checkpoint precisam ser atestados por uma fonte independente**, com pin externo do manifesto de histórico ou recibo transacional validado, antes de usá-la em um build protegido. O campo `independentFullHistoryAttestationVerified` fica sempre **false** nesta etapa.

**Estado:** contrato offline com dados sintéticos e CI; [issue CMS #4](https://github.com/rafhael100/imagine-comercial/issues/4) permanece bloqueada por identidade/MFA/tenant real, publicação transacional, revogação e homologação Leaseweb. PR #155 permanece DRAFT/NO-GO. Nenhuma atualização de `main`, DNS, 301, lead real ou custo.
