# F241 — Páginas internas coerentes com a identidade Imagine

Continuação da F240, que preservou a logo original e instalou a paleta laranja/tinta da primeira versão Node do Portal no layout e na homepage.

A F241 propaga o mesmo vocabulário visual para sete templates de páginas internas: serviços, detalhe de serviço, comparação, artigos, listagem de conteúdos, perguntas frequentes e descrição do processo de contratação.

- **Ações e links:** castanho escuro acessível `#884100`, próximo do laranja da marca sem usar a cor laranja clara como texto pequeno sobre branco.
- **Foco por teclado:** `#b45b00` preserva contorno de três pixels e deslocamento dos seletores e botões.
- **Painéis:** cores claras e discretas em `#f7f7f8`, `#fffaf4`, com bordas neutras.
- **Estados funcionais:** controles selecionados, listas acessíveis e estados concluídos mantêm diferenciação por contraste e atributos `aria-pressed`; indicadores verdes de sucesso/ação concluída não são artificialmente convertidos em erro.

O contrato `tests/interior-brand-palette.test.mjs` impede o retorno dos azuis principais nos estilos locais. O navegador/axe WCAG e Lighthouse do workflow continuam obrigatórios para aprovação.

**Escopo:** apenas estilos de DEV; não altera textos, URLs, SEO, receitas, contrato, DNS, redirecionamento, scripts de formulário ou identidade/tenant. A identidade do Laravel Portal/CRM/Sites deve seguir a mesma referência em entregas específicas nos respectivos repositórios, não por importação cega de CSS.
