# F222 — Reconciliação de cobertura GSC das rotas legadas

**Fonte privada de evidência:** leitura autorizada e sem alteração da propriedade `sc-domain:imaginecomunicacao.com.br`, relatório GSC web `page` com dados finalizados em 12/11/2026. **Nenhum número de tráfego, consulta, dado pessoal, chave, credencial ou parâmetro de URL está neste repositório.**

A execução paralela **F221** já havia adicionado ao catálogo duas rotas em inglês, ambas em HOLD:

- `/en-us/services/criacao-de-sites-institucional.html`
- `/en-us/services/youtube-ads-anuncios.html`

A F222 preserva integralmente esses dois itens e acrescenta **dois outros caminhos públicos distintos** em HOLD, sem destino:

- `/o-que-fazemos/linkedin-business.html` — decisão editorial de LinkedIn Business, não redirecionar automaticamente para Meta/Google Ads
- `/termos-de-uso.html` — preservar e validar conteúdo jurídico português, não redirecionar indiscriminadamente

**Cobertura pós-reconciliação:** 27 caminhos distintos, 5 `candidate` não aprovados e 22 `hold`. O contrato de navegador testa os 27 caminhos na prévia e exige 404/noindex; a rotina de staging privado inspeciona os 22 HOLD individualmente e continua sem ativação de 301.

**Variantes de host** HTTP/HTTPS e `www`/raiz foram observadas em GSC para a home, mas não são endereços com caminhos distintos e exigem política de host canônico, TLS e redirecionamento revisada separadamente.

**Limitação:** Search Analytics só demonstra páginas com métricas na janela; não representa indexação completa, crawl HTTP atual, inventário de backlinks ou equivalência editorial. A consulta privada e os números detalhados permanecem fora do GitHub. Nenhum item tem aprovação para 301/308, DNS, Cloudflare, publicação ou `main`. Staging Leaseweb, revisão jurídica/idioma, SEO/AppSec/LGPD e autorização humana são gates separados.
