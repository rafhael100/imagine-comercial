# Comercial SEO-F148 — Fragmentos entre páginas e seleção segura de serviço

O build Astro passou a conferir também links que apontam para uma seção de **outra página** (`/caminho/#id`). A auditoria F147 já verificava âncoras dentro da própria página; agora a F148 exige que o destino exista no HTML da rota ou seja um dos slugs de serviço aprovados pelo catálogo para a seleção controlada em `/contato/#slug`.

Um fragmento arbitrário não pode ser usado para simular seleção de serviço, nem para criar links para páginas ou seções inexistentes. A regra diferencia âncoras HTML reais das intenções de contato manipuladas pelo JavaScript já testado pelo navegador. Todo o inventário de páginas é lido localmente do build, sem requisições, tokens ou dados pessoais.

**Revisão antes de produção:** códigos e testes no PR draft. Não habilita publicação, domínio, redirects, merge `main` ou acesso Google.
