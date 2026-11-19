# Comercial SEO-F144 — Títulos e descrições exclusivas em todas as páginas

Além das verificações de canonical, sitemap, JSON-LD, links e robots, o pipeline da Imagine audita agora todos os arquivos HTML indexáveis gerados pelo Astro. Cada página deve conter exatamente um `<title>` (20–110 caracteres) e uma única meta description descritiva (60–220 caracteres), sem duplicações mesmo quando diferenças forem apenas maiúsculas, espaços ou entidades básicas.

A verificação é executada em `scripts/verify-dist.mjs`, que já roda após o build e após o ensaio de catálogo. Erros não expõem o texto de título ou descrição; o objetivo é impedir publicação acidental de metadados genéricos, ausentes ou repetidos. O resultado não mede posições de ranking nem atribui autoria, data ou resultados ao conteúdo.

Somente branch de revisão e CI sintética: sem DNS, deploy, OAuth real do Portal, dados de clientes, redirects 301 ou merge `main`.
