# F214–F215 — Revisão offline de histórico assinado CMS

O comando `node scripts/review-signed-catalog-history.mjs` examina **2 a 32** releases parciais assinados e fixados por hash, fornecidos em ordem cronológica por um operador em diretório privado e confiável. A ausência de um serviço em uma publicação **não** apaga o último estado revisado.

Defina `IMAGINE_HISTORY_MANIFEST_FILE` como o caminho absoluto para o manifesto local JSON. Os arquivos referidos ficam **na mesma pasta** e são limitados a nomes simples (`.json`, `.pem`), sem `../`, caminhos absolutos, symlinks finais ou arquivos de clientes no Git. A pasta do manifesto precisa ser controlada pelo operador; esta rotina não confere permissões do sistema sobre diretórios ancestrais.

Formato sintético de manifesto:
```json
{
  "schemaVersion":"imagine.comercial.signed-history-manifest.v1",
  "keys":[{"keyId":"portal_key_public_01","file":"key-01.pem"}],
  "releases":[
    {"file":"release-01.json","releaseId":"release_review_01","sha256":"<64 caracteres hexadecimais>"},
    {"file":"release-02.json","releaseId":"release_review_02","sha256":"<64 caracteres hexadecimais>"}
  ]
}
```

O revisor verifica Ed25519, pin independente, datas crescentes e não futuras, unicidade de release IDs, identidade/slug, versão de cada serviço mantida entre deltas e SEO final a cada lançamento. Pode usar várias chaves **públicas** quando houver rotação. A saída contém apenas contadores e flags **`canPublish:false`, `completeReleaseHistoryVerified:false`**.

**NO-GO:** um manifesto fornecido pelo operador não demonstra que a cadeia contém todas as publicações já existentes; não substitui ledger durável, Portal autenticado, MFA, direitos por empresa, AppSec/DBA/LGPD, staging, assinatura privada gerida nem autorização de deploy. Nunca incluir arquivos reais de clientes/keys privadas em GitHub.
