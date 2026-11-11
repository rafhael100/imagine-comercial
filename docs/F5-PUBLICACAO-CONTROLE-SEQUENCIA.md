# F5 — Sequência segura de publicações do catálogo

Camada **offline** de preparação para que a integração futura com o Portal não publique versões obsoletas, altere preços/conteúdo sem versionamento nem remova páginas de serviços silenciosamente.

Módulo: `src/lib/publication-sequence.mjs`.

## Regras
- Validar snapshot público com contrato F2.
- Idempotência: repetição idêntica é `noop`; reutilização da mesma ID de publicação com conteúdo distinto falha.
- Alteração de dados exige incremento de versão individual.
- Publicação precisa ter timestamp posterior ao lote anterior.
- Remover serviço e alterar slug exigem aprovação e plano explícito de migração SEO antes de poderem ser aplicados.
- O retorno descreve somente o que seria aplicado; não grava arquivos, não chama API, não modifica DNS e não faz deploy.

## Não implementado
- AuthN/AuthZ do publicador, assinatura criptográfica, hash de artefatos, aprovação efetiva no Backoffice, banco transacional, concorrência distribuída, rollback autorizado ou publicação em produção.
- O responsável deve homologar permissões, rastreabilidade e casos de segurança antes da primeira integração real com o Portal.

Relacionamento: `docs/F2-CONTRATO-CATALOGO-PUBLICADO-v0.1.md`, PR #5, issue #4 e F3 (redirecionamentos).
