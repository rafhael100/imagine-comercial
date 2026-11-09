# F1 — Páginas comerciais, SEO e conversão

## Entrega técnica neste recorte
- Catálogo editorial único em `src/data/services.mjs` com seis páginas de serviços verificáveis e um guia educativo inicial.
- Geração estática de páginas por slug explícito (não geração de páginas municipais em massa).
- Sitemap derivado das mesmas rotas editoriais, com URLs normalizadas.
- Layout acessível, identidade visual inicial e metadados por página, `Organization`, `WebPage`, `BreadcrumbList` e `Service` quando adequados.
- CTAs para contato por e-mail/telefone utilizando canais atualmente publicados pela Imagine. Sem formulários que simulem envio e sem links para checkout não homologado.
- Testes de contrato de conteúdo sob `node --test` (executar com Node 22+).
- Nenhuma alegação de ranking, resultados de cliente, avaliação, certificação ou preço foi criada.

## SEO: princípios e limitações
- `imaginecomunicacao.com.br` é endereço de destino; não alterar DNS, HTTPS, indexação ou substituir site atual até inventário completo.
- O domínio atual público usa `www` e páginas antigas .html; definir canonical da migração e redirecionamentos individuais somente após auditoria.
- O catálogo demonstrativo não representa API nem CMS real. O Portal será a única autoridade sobre ofertas e preços; integração read-only requer contrato de segurança, versão de publicação, cache e rollback.
- Este PR não habilita captura de leads no CRM nem checkout; o e-mail/telefone são canais públicos já presentes no site atual.
- SEO geográfico depende de evidência, conteúdo substancial e revisão individual; sem páginas doorway ou geração indiscriminada.

## Inventário de migração — amostra verificada, não lista exaustiva
URL atual / provável destino:
- `https://www.imaginecomunicacao.com.br/` => `/`
- `https://www.imaginecomunicacao.com.br/fale-conosco.html` => `/contato/`
- `https://www.imaginecomunicacao.com.br/agencia-imagine-comunicacao-digital.html` => **pendente**, pois ainda falta página de apresentação equivalente.
- `https://www.imaginecomunicacao.com.br/clientes.html` => **pendente**, pois ainda falta portfólio/autorização de divulgação.
- `https://www.imaginecomunicacao.com.br/en-us/` e subpáginas => **pendente de decisão** sobre manutenção de páginas em inglês e `hreflang`.

**NÃO configurar redirecionamento genérico de todas as páginas antigas para a home.** Preserve conteúdo e backlinks relevantes durante a migração.

## Gates e próximos passos
- Gerar e revisar `package-lock.json` com npm em ambiente autorizado, instalar pacotes e executar `npm test`, `npm run build` e `astro check` quando configurado.
- Validar as páginas com navegador real (mobile/desktop), Lighthouse, axe, JSON-LD, 404, canonical, sitemap, TLS e headers.
- Revisar copy e estilo com a equipe Imagine, conferir dados de contato e materiais visuais próprios.
- Homologar conectores Portal/SEO Engine e integridade de ofertas antes de ativar contratação online.
- Desenvolver matriz de 301 de todas URLs atuais antes de implantação; validar políticas de privacidade.
- Trabalho isolado em PR draft empilhado sobre F0, sem merge ou deploy automático.

Referências:
https://github.com/rafhael100/imagine-portal/issues/99
https://github.com/rafhael100/imagine-portal/issues/100
https://github.com/rafhael100/imagine-portal/issues/102
