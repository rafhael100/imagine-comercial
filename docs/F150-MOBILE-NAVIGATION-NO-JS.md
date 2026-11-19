# F150 — Navegação móvel sem JavaScript

A navegação desktop permanece intacta. Para larguras até 820px, o topo exibe um menu nativo HTML `details/summary`, com rotas canônicas curadas e indicação `aria-current=page`. O menu abre com Enter e toque, funciona com JavaScript desligado e inclui a página de processo, FAQ e os canais de contato.

- Não usa cookies, armazenamento, eventos de analytics, API, dados pessoais ou bibliotecas de menu.
- O link ao Portal aparece somente quando `PUBLIC_PORTAL_LOGIN_URL` passa pela allowlist F29; não habilita autenticação.
- Mantém skip link, foco visível, contraste e acesso normal ao conteúdo principal.
- O QA Chromium avalia 375px e 1440px, valida exibição por breakpoint, navegação, `aria-current`, teclado e sem JavaScript, além de axe WCAG 2.1 A/AA.

O build é revisão de desenvolvimento; publicação depende dos gates F70/Portal/CRM/SEO/SEG, revisão visual e autorização do release. Nenhum deploy, DNS, 301 ou custo adicional.
