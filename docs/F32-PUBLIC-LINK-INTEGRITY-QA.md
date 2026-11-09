# F32 — Integridade de navegação pública e canais externos

Data: 09/11/2026. Controle local de segurança, acessibilidade e conversão, **sem requisições externas**.

## Falha de qualidade que o controle evita

Um site Astro estático pode passar nos testes de SEO, Lighthouse e layout, mas ainda publicar um link interno inexistente ou alterar silenciosamente um CTA para número de telefone, destinatário de e-mail ou domínio externo não aprovado. O F32 verifica os `href` que o navegador de fato renderiza, incluindo conteúdo gerado por componentes e catálogo.

## Implementação

- O módulo `src/lib/public-link-review.mjs` aceita os links capturados pelo Chromium e exige que destinos internos sejam caminhos exatos do inventário `sitePages`. Links de serviço, artigos e menus não podem apontar para uma página que não faz parte do sitemap.
- Fragmentos precisam referenciar um `id` existente na página de origem, exceto a convenção deliberada `/contato/#serviceSlug`, que seleciona um serviço válido no dropdown.
- Canais externos permitidos são somente WhatsApp oficial `wa.me/5585996632689` (texto curto e contextual), `mailto:imagine@imaginecomunicacao.com.br` (assunto comercial permitido) e `tel:+558530329525`.
- Rejeita esquemas perigosos, domínio parecido, canal trocado, links locais com query, traversal, escapes percent-encoded ou barras duplas; links em nova aba exigem `rel=noopener noreferrer`.
- Erros de teste registram somente rota, índice e categoria da falha. A URL inteira e os parâmetros não são incluídos na exceção para evitar vazamento de tokens/PII.
- O navegador percorre todas as **15 rotas públicas** no mobile, seis no desktop e a página HTTP 404, executando a verificação dos links renderizados sem clicar em canais de atendimento e sem fazer requisições externas.

## O que não fica demonstrado

Não se trata de verificação real de disponibilidade do WhatsApp, entrega de e-mails, chamadas telefônicas ou operação de login/CRM. A lista de contatos está baseada nas informações já presentes no protótipo e precisa ser **reconfirmada com o responsável comercial** antes de assumir como canal produtivo. Redirecionamentos históricos 301 exigem GSC/crawl reais, equivalência editorial e aprovação separada.

A futura mudança de canais oficiais ou inclusão de links externos só poderá ocorrer após revisão humana da allowlist, sem aceitar domínios ou números vindos de conteúdo editorial não verificado.

Sem `main`, deploy, DNS, Cloudflare real, dados pessoais ou custos adicionais.
