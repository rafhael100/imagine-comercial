# Comercial SEO-F150 — Inventário fechado do HTML público

Antes de aceitar o build Astro, o sistema confere agora a lista **completa** de arquivos `.html` de `dist/`, comparando-a com as páginas previstas no catálogo de rotas públicas mais a página especial `404.html`. Qualquer página HTML extra — como um rascunho, uma rota administrativa, uma prévia de cliente ou um teste de integração acidentalmente exposto — bloqueia o pacote, mesmo que não esteja no sitemap.

A validação também detecta arquivo ausente, saída duplicada, pasta com grafia ambígua ou caminho não canônico. Complementa o controle de indexação, sitemap, auditoria de navegação F145, acessibilidade e proibição de captação não homologada. Não faz HTTP e não lê dados de clientes. Testes adversariais verificam que os erros não imprimem caminhos privados.

**HOLD:** o controle local de build não autoriza publicação nem substitui staging isolado, revisão de segurança, inventário de URLs legadas ou aprovação editorial. Sem merge na `main`, alteração de DNS, 301, deploy ou novos gastos.
