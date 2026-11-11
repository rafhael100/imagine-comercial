# F3 — Migração SEO sem perda desnecessária de URLs

## Estado
**Apenas inventário parcial e validador OFFLINE. Nenhum redirecionamento foi ativado.**
A decisão de usar `imaginecomunicacao.com.br` como canônico e resolver `www`/HTTPS permanece condicionada à auditoria da propriedade no Search Console e à homologação da migração.

## Páginas existentes localizadas publicamente em 09/11/2026
- `https://www.imaginecomunicacao.com.br/` — homepage pública.
- `https://www.imaginecomunicacao.com.br/fale-conosco.html` — contato.
- `https://www.imaginecomunicacao.com.br/agencia-imagine-comunicacao-digital.html` — apresentação da agência.
- `https://www.imaginecomunicacao.com.br/clientes.html` — página de clientes.
- `https://www.imaginecomunicacao.com.br/en-us/`, `/en-us/customers.html`, `/en-us/contact-us.html` — conteúdo em inglês.

Outras URLs, HTTP/www/sem-www, campanhas, conteúdos externos, imagens, documentos, sitemap atual, backlinks, páginas antigas removidas e buscas ainda exigem verificação no Google Search Console ou crawl autorizado.

## Política de redirecionamentos
- `src/data/legacy-urls.mjs`: fontes confirmadas, destino **candidato** ou **pendente (hold)**.
- `src/lib/redirect-plan.mjs`: impede wildcard, redirecionamento externo, laços, destino inexistente e origem repetida.
- Somente uma entrada com status `approved` individual poderia gerar regra **em memória**, para posterior revisão. Nenhum arquivo `_redirects` é criado em produção nem alterado.
- Páginas em inglês exigem avaliação de continuidade/hreflang, sem redirecionamento indiscriminado para o português.
- Portfólio não migrará para uma página genérica sem autorização para exibir clientes e equivalência de conteúdo.

## Próximas ações antes da publicação
1. Conectar e autorizar Search Console, exportar cobertura/queries; obter inventário integral, backlinks e sitemap.
2. Definir cada destino, equivalência semântica, canonical host e política de URL por idioma.
3. Aprovar regras individualmente, testar em staging protegido (rotas, 301/308, loops, cadeias, 404, canonical).
4. Agendar janela controlada de lançamento, backup e rollback, com acompanhamento Google Search Console.
5. Não usar `robots.txt` como proteção para staging/área privada; autenticação e/ou `noindex` correto.

Nenhuma mudança de domínio, DNS, sitemap em produção, pagamento ou gasto.
