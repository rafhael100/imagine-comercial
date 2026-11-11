# F75 — QA real dos canais comerciais nas seis páginas de serviços

## Escopo
A validação em Playwright foi ampliada para todas as seis páginas de serviço, tanto em tela mobile quanto desktop, além do fallback com JavaScript desativado.

- Confere as URLs `wa.me` e `mailto:` exatas derivadas exclusivamente do catálogo público curado.
- Confere abertura segura do WhatsApp, texto acessível do aviso de transferência e ausência de formulários.
- Não clica em links externos, não transmite contatos, não cria leads e não inventa conversões.

## Segurança e evidências
O pipeline de CI continua executando contratos Node, build Astro, auditor SEO e navegador; o PostgreSQL descartável é independente. O gate F70 de equivalência da captação de orçamentos do site legado permanece pendente, assim como a homologação de Portal/CRM e a revisão de migração. Nenhum CI autoriza deploy, DNS, produção ou merge da main.

## Como revisar
Executar `npm test && npm run build && npm run test:browser` em ambiente isolado de CI. Rejeitar qualquer caminho divergente do serviço curado, ausência de anúncio acessível ou requisição não autorizada. Sem custos adicionais.
