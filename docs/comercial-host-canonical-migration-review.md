# F222 — Revisão de host canônico na migração (somente planejamento)

**Problema técnico:** o site institucional público utiliza links sob `https://www.imaginecomunicacao.com.br/`, enquanto a compilação Astro na DEV configura `https://imaginecomunicacao.com.br/` (sem `www`). A mudança de host é uma decisão de SEO e infraestrutura, não um detalhe a corrigir com substituição cega.

O contrato `reviewCanonicalHostMigration({legacyOrigin,candidateOrigin})` compara **somente** as duas origens HTTPS do domínio próprio. Não consulta a rede; os argumentos fornecidos pelo operador não comprovam Google Search Console, HTTP real ou a propriedade dos domínios.

## Portões obrigatórios antes de qualquer produção
- **Escolher explicitamente** o host canônico futuro (`www` ou raiz) com o responsável pelo SEO e comercial.
- Inventariar todas as variantes `http`/`https` e `www`/sem `www` do domínio antigo, sem adivinhar cobertura.
- Definir o redirecionamento de host **e de caminhos** URL a URL: nenhuma página inglesa, jurídica, portfólio ou produto em HOLD poderá ser enviada automaticamente para a home.
- Homologar HTTPS/TLS, status HTTP real e cadeias 301/308 sem loops; conferir `canonical`, `og:url`, `twitter:url`, sitemap, `robots.txt` e `hreflang` conforme a opção aprovada.
- Revisar o impacto no Search Console, backlinks relevantes e conteúdo editorial e preparar rollback.
- Obter aceite de staging, LGPD/AppSec, autorização de publicação e só então considerar a `main`/Cloudflare/DNS.

**Estado:** host change identificado como ponto de revisão; `canPublish:false`, `redirectsAuthorized:false`, `dnsChangeAuthorized:false`. CI local não é evidência de que qualquer redirect está ativo.

Nunca copiar consultas ou métricas reais de Search Console para este repositório público.
