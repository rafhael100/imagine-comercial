# Comercial SEO-F151 — Nomes acessíveis dos links

A auditoria do build Astro inspeciona os links `<a>` de **todas as páginas publicáveis** e rejeita aqueles sem um nome acessível significativo. São aceitos texto visível descritivo, `aria-label` ou `alt` textual de imagem; ícones isolados, links vazios ou textos excessivamente extensos não passam. Âncoras malformadas também são bloqueadas.

É um complemento aos testes de navegador, axe-core e aos controles F143/F147/F148 de rotas e fragmentos. A validação é local e não inspeciona estados interativos que só existam após execução do JavaScript — esses continuam sendo responsabilidade do teste funcional do navegador e da revisão de acessibilidade.

Não existe mudança em produção, DNS, domínio, redirects, autenticação, ofertas ou conteúdo privado. A liberação exige revisão editorial e testes completos em staging; a PR permanece rascunho.
