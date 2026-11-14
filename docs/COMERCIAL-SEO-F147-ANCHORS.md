# Comercial SEO-F147 — Verificação de âncoras internas e links de acessibilidade

O build verifica agora se os links dentro da mesma página (`href="#id"`) apontam para elementos que realmente existem no HTML compilado. IDs ausentes, duplicados e vazios provocam falha na CI. Isso protege links de pular para o conteúdo, atalhos para seções e a navegação com teclado.

Links de outra página com fragmentos, como `/contato/#landing-pages`, continuam sendo validados pela F143 quanto à rota de destino; a seleção por fragmento na tela de contato já possui fluxo funcional próprio e não deve ser confundida com um ID estático.

É uma validação totalmente local de HTML Astro, sem execução da aplicação em produção, sem requisições externas ou dados de visitantes. Nenhum deploy, DNS, redirecionamento ou merge `main` foi feito.
