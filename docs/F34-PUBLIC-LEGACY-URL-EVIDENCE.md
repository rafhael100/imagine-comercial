# F34 — Evidência pública do menu legado, revisão de migração SEO

**Data da consulta:** 09/11/2026  
**Fonte:** páginas publicamente recuperadas de `https://www.imaginecomunicacao.com.br/` e seus oito destinos de navegação de serviços, sem autenticação nem requisições mutativas.

## Fatos verificáveis desta amostra

A homepage pública contém links para os seguintes oito caminhos, cujos conteúdos foram recuperados durante esta rodada:

1. `/o-que-fazemos/criacao-de-sites-institucional.html`
2. `/o-que-fazemos/criacao-de-loja-virtual.html`
3. `/o-que-fazemos/google-ads-anuncios.html`
4. `/o-que-fazemos/facebook-instagram-ads.html`
5. `/o-que-fazemos/youtube-ads-anuncios.html`
6. `/o-que-fazemos/linkedin-ads-anuncios.html`
7. `/o-que-fazemos/marketplace-amazon.html`
8. `/o-que-fazemos/marketplace-mercado-livre.html`

O arquivo `src/data/legacy-public-evidence.mjs` registra a origem oficial, a data da observação e os **limites explícitos** da evidência. Isso não constitui crawling em profundidade, inspeção HTTP ao vivo, inventário de todos os hosts, medição Google ou aprovação de redirecionamentos.

**Duas observações refinadas:**

- A página de anúncios Facebook/Instagram possui conteúdo público visível, e portanto o inventário não deve mais dizer que o conteúdo era desconhecido. O redirecionamento para gestão Meta continua **candidato, não aprovado** — requer equivalência, intenção, histórico e consentimento editorial.
- A página do serviço Mercado Livre também tem conteúdo público visível, mas a oferta não tem serviço equivalente confirmado no novo catálogo. Sua URL continua **HOLD** e sem destino sugerido.

Os dados públicos também mostram páginas próprias de clientes, conteúdo em inglês e termos/privacidade em inglês. Continuam em HOLD, pois é preciso preservar legalidade, idioma, portfólio autorizado e comportamento de URLs de tráfego existente.

## Fontes de revisão
- <https://www.imaginecomunicacao.com.br/>
- <https://www.imaginecomunicacao.com.br/o-que-fazemos/facebook-instagram-ads.html>
- <https://www.imaginecomunicacao.com.br/o-que-fazemos/marketplace-mercado-livre.html>
- <https://www.imaginecomunicacao.com.br/clientes.html>
- <https://www.imaginecomunicacao.com.br/en-us/>
- <https://www.imaginecomunicacao.com.br/en-us/termos-de-uso.html>

Não foi possível recuperar os arquivos públicos `robots.txt` e `sitemap.xml` por meio da ferramenta de consulta nesta rodada. **Isso não prova que estejam ausentes ou que respondam 404**. Exigem confirmação com crawler HTTP autorizado.

## Portão de liberação

Antes da migração do domínio: cruzar inventário com Search Console real privado, crawler de `http`/`https`, `www`/apex, sitemap/robots, URLs fora do menu e backlinks; verificar pares origem→destino, conteúdo, histórico, idiomas, canônicos, 404/410, privacidade e questões comerciais; obter aprovação humana de cada regra e testar em homologação isolada.

Nenhum conteúdo completo do site antigo foi copiado, nenhuma certificação/resultado foi assumido como atual, nenhum redirect ou arquivo produtivo foi criado. `main`, DNS e Cloudflare permanecem inalterados.
