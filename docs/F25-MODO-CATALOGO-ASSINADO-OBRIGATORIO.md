# F25 — Modo obrigatório de catálogo assinado para builds de publicação

Data: 09/11/2026. Estado: desenvolvimento em laboratório, sem produção.

## Problema
Até F24, o site aceitava um build editorial padrão quando todos os cinco parâmetros de um catálogo assinado estavam ausentes. Isso é adequado para preview local; porém, se um orquestrador de publicação perdesse todos os parâmetros por engano, poderia compilar um catálogo editorial antigo sem sinalizar falha. Assinatura e SHA-256 não resolvem esse caso porque nenhum conteúdo assinado sequer é entregue ao verificador.

## Contrato novo
O ambiente de build confiável pode declarar IMAGINE_CATALOG_REQUIRE_SIGNED=1. Nesse modo:

- Sem os cinco parâmetros de envelope, chave pública confiável, keyId, releaseId e SHA-256, o build falha fechado.
- Com parâmetros parciais, o build falha fechado.
- Com todos os parâmetros, a validação já existente de Ed25519, releaseId, hash e catálogo permanece obrigatória.
- Qualquer valor não documentado para IMAGINE_CATALOG_REQUIRE_SIGNED é rejeitado, evitando tratar true, yes ou um booleano como autorização.
- O default local, sem o indicador e sem configurações de catálogo, continua exibindo o conteúdo editorial estático. Isso **não é** um modo de publicação autorizada.
- No CI, a simulação de catálogo assinado usa explicitamente o indicador obrigatório e executa um build negativo com TODOS os cinco parâmetros omitidos para comprovar que não ocorre fallback.

## Controles que ainda faltam
Este indicador é apenas uma configuração **dada por um processo externo de build**. Um ator com permissão para escolher variáveis pode removê-lo; ele não prova a identidade de quem aprovou ou executou a publicação. É indispensável pipeline protegido, grants de Portal obtidos de autoridade real, MFA, revogação durável, publicação idempotente, confirmação do destino, aprovação editorial e gestão segura de chaves.

O default editorial e o modo assinado não são ambientes prontos para produção nesta branch. Nenhum merge em main, cloud deploy, alteração DNS, cliente real ou financeiro é autorizado.
