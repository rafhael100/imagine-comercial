# Comercial SEO-F152 — Filtros de assuntos na biblioteca de guias

A página `/conteudos/` ganhou filtros de temas para ajudar visitantes a encontrar mais rapidamente conteúdos sobre sites, Landing Pages, SEO, anúncios e contratação. O catálogo é **curado** em `src/data/article-topics.mjs`, sem gerar novas URLs ou páginas repetidas; um guia pode aparecer em mais de um tema pertinente.

A navegação usa botões com `aria-pressed`, grupo com nome acessível e contagem de artigos anunciada com `aria-live`. O JavaScript só esconde ou mostra os cartões já presentes no HTML. Sem JavaScript, todos os artigos e seus links continuam disponíveis e os controles inativos não aparecem.

**Política de privacidade preservada:** nenhum formulário, `input`, campo de busca livre, cookie, armazenamento local, `fetch`, métrica de visitante, URL de rastreamento ou chamada de rede. Isso respeita o bloqueio F76 de captação pública antes da homologação do Portal/CRM. A UI tem testes em navegador mobile/desktop, modo sem JavaScript, suíte unitária e verificadores de HTML/SEO.

A entrega permanece em PR draft e CI; não equivale a aprovação editorial ou deploy. Sem alteração de DNS, redirecionamentos, merge `main`, tokens GSC ou custos extras.
