# F245 — Trilha de navegação visível e consistente em todas as páginas internas

Antes, o site já gerava JSON-LD `BreadcrumbList` a partir de `breadcrumb`, mas a trilha visual era manual em cinco templates e inexistente em várias páginas do catálogo. Isso gerava uma diferença de experiência entre serviços, artigos, contato, sobre e listagens.

## Entrega funcional

- O layout compartilhado passa a renderizar uma **navegação semântica** `<nav aria-label="Caminho de navegação"><ol>...` em qualquer rota com `breadcrumb`.
- O primeiro item é sempre **Início**; os intermediários são links acessíveis; somente o último tem `aria-current="page"`, sem falsificar links para páginas ancestrais.
- Os cinco breadcrumbs manuais antigos foram retirados, evitando duplicidade. A mesma propriedade `breadcrumb` continua alimentando o JSON-LD existente, sem mudar o domínio canônico.
- Identidade visual laranja/grafite, foco por teclado e apresentação responsiva com quebra de linha no celular. Sem JavaScript, cookies, entrada de dados ou chamadas remotas.
- A home e o 404 permanecem sem trilha, evitando rotular a home como descendente e evitando canonical no erro.

## Validações

Testes F245 verificam semântica e ausência de duplicação. O QA Chromium percorre todas as páginas atuais no celular e amostras desktop, exige o link ao início, estrutura ordenada, último item atual, nome legível e ausência de informação enganosa. Permanecem obrigatórios os gates SEO, WCAG, Lighthouse, P0, PostgreSQL e Workerd no CI.

**Escopo:** somente DEV do site Comercial; não implica homologação Leaseweb, integração operacional Portal/CRM, aprovação GSC/301 ou publicação.
