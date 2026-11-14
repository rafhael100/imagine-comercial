# F240 — Identidade visual original Imagine no site Comercial (somente DEV)

## Fonte da identidade aprovada

A identidade do Imagine Comercial foi alinhada à primeira versão Node.js do Imagine Portal:

- **Fonte de verdade:** repositório `rafhael100/imagine-portal` na branch `main`, arquivo `assets/logo-imagine.png`, preservado **byte a byte**, sem redesenho. Git blob SHA-1: `678adeceb3a8ecdaeb6b576b9ee18d1bf0396f77`. O arquivo agora fica localmente em `public/logo-imagine.png`, evitando dependência de imagem de terceiros.
- **Cores de referência:** laranja `#f9941d`, tinta `#171b19`, cinza leve `#f7f7f8`, divisórias `#e8e8e8`, usadas em `portal.css`. Para contraste acessível de links sobre branco, o tom de texto é o castanho escuro `#884100`, sem mudar a cor oficial da marca.
- **Estilo:** navegação clara, botões arredondados com superfícies neutras, espaços generosos, cartões discretos e destaque laranja reservado à ação principal.
- **Layout:** logo real no cabeçalho comum a todas as páginas, alinhamento de CTA, hero decorativo, homepage e contato; mantém menu móvel sem JavaScript, link de pulo, foco visível e mensagens sem captação.
- **Segurança:** não ativa formulário, checkout, scripts remotos, cookies, redirecionamentos ou novos endpoints.

## Gates de aceite

`tests/original-imagine-brand.test.mjs` verifica a assinatura Git exata do PNG original e tokens de layout. O QA de navegador exige `/logo-imagine.png` carregada em todas as rotas desktop e mobile. Testes SEO, acessibilidade, Lighthouse, budgets e Workerd continuam como condições de merge em DEV.

**Limites:** esta é a camada visual comercial, não a implementação final das interfaces Laravel do Portal/CRM/Sites. A decisão do usuário de manter a mesma identidade nos demais produtos continua válida, mas exige PRs separados por repositório e revisões de seus layouts. Nenhum deploy nem merge na `main` é autorizado por esta etapa.
