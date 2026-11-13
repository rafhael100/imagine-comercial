# F244 — Menu de orientações e navegação por seção (Imagine Experience)

O cabeçalho público utilizava `aria-current="page"` corretamente para as URLs exatas, mas não apresentava qualquer indicação de grupo ativo dentro de `/servicos/{slug}/` e `/conteudos/{slug}/`. Além disso, o desktop deixava “Como funciona” e “Perguntas frequentes” apenas no rodapé, embora já fossem opções diretas do menu móvel.

**Implementação funcional:**
- Mantém `aria-current="page"` somente no link da URL exata e usa `data-section-active="true"` para destacar a seção-pai, sem induzir leitores de tela a acreditar que o usuário está em outra página.
- Adiciona grupo **Orientações** no desktop, por `details/summary` nativo e sem JavaScript, com links para “Como funciona” e “Perguntas frequentes”. Em uma dessas rotas, o grupo fica destacado e o link correto tem `aria-current="page"`.
- Ajusta o limite do menu móvel para **1020px** para evitar navegação espremida em tablets; todos os links continuam acessíveis por teclado e alvos de toque de 44px.
- Conserva o menu móvel, a logomarca, os atalhos ao Portal aprovados, a identidade Imagine `#F9941D`, os links curados e a ausência de cookies/telemetria/POST.

**Validação:** testes Node F63/F150/F244 e Chromium QA das páginas do catálogo, dropdown desktop, hierarquia de seções, navegação móvel e amostra tablet a 960px (incluindo overflow). Axe WCAG e Lighthouse permanecem gates obrigatórios da branch. Nenhuma alegação de qualidade substitui a inspeção operacional dos dispositivos reais, zoom 200% e da VPS.

**Escopo:** somente interface de desenvolvimento do site Comercial; não altera autenticadores, endpoints Portal/CRM, conteúdo/SEO, DNS, redirect, checkout, `main` ou produção.
