# F248 — Perguntas frequentes com filtros de tema e expansão acessível

## Funcionalidade entregue
A página pública `/perguntas-frequentes/` mantém o catálogo original de quatro temas e oito perguntas, incluindo suas URLs estáveis `#faq-...` e `#duvida-...`.

Com JavaScript disponível, a página oferece:
- filtros por **Todos os temas, Escopo e planejamento, Proposta e condições, Campanhas e resultados, Aprovações e acesso**;
- estado acessível `aria-pressed` no filtro escolhido, `aria-controls` e anúncio de quantidade de resultados em `role=status`;
- botões de **expandir respostas visíveis** e **recolher respostas visíveis**, usando `details` HTML nativo;
- links de âncora que cancelam o filtro quando necessário, para impedir que uma resposta de outro tema fique oculta;
- cores oficiais Imagine `#F9941D` e grafite, links contrastantes, foco de teclado e área de toque de 44px.

Sem JavaScript, os controles adicionais continuam invisíveis e **todos os oito itens permanecem no HTML e acessíveis**, inclusive os links diretos e os botões nativos para abrir individualmente cada resposta.

## Privacidade e segurança
Somente conteúdo estático e IDs de assuntos revisados são utilizados; nenhum texto livre, cadastro, campo pessoal, cookie, armazenamento local, analytics, request externo, alteração de URL de consulta ou submissão é criado. A escolha existe apenas na memória transitória da página e não faz parte de dados comerciais.

## Aceite técnico
Testes Node verificam os quatro temas, catálogo fechado, ausência de coleta e semântica de filtros. O QA Chromium exercita filtragem de campanhas, contagem de duas perguntas, expandir/recolher, link direto de pergunta oculta e funcionamento sem JavaScript. Os gates SEO, Lighthouse, WCAG, Workerd e PostgreSQL da integração permanecem obrigatórios.

**Escopo:** DEV do site público. Não habilita orçamento público nem substitui homologação real da Leaseweb, Portal/CRM, SEO de legado, parecer LGPD/AppSec ou aprovação de deploy.
