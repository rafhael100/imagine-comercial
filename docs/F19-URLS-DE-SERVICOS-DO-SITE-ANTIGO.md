# F19 — Inventário de oito URLs de serviços legados (09/11/2026)

## Novas URLs encontradas na navegação pública
A homepage do site antigo aponta para oito páginas em `/o-que-fazemos/`, confirmadas pelos links de navegação e, quando possível, pelo conteúdo público recuperado.

| URL antiga | Nova URL sugerida | Estado |
|---|---|---|
| `/o-que-fazemos/criacao-de-sites-institucional.html` | `/servicos/criacao-de-sites/` | candidata; revisão editorial |
| `/o-que-fazemos/google-ads-anuncios.html` | `/servicos/gestao-google-ads/` | candidata; revisão editorial |
| `/o-que-fazemos/facebook-instagram-ads.html` | `/servicos/gestao-meta-ads/` | candidata; conteúdo HTTP não recuperado nesta busca |
| `/o-que-fazemos/criacao-de-loja-virtual.html` | nenhuma homologada | HOLD |
| `/o-que-fazemos/youtube-ads-anuncios.html` | nenhuma homologada | HOLD |
| `/o-que-fazemos/linkedin-ads-anuncios.html` | nenhuma homologada | HOLD |
| `/o-que-fazemos/marketplace-amazon.html` | nenhuma homologada | HOLD |
| `/o-que-fazemos/marketplace-mercado-livre.html` | nenhuma homologada | HOLD; timeout no acesso HTTP |

Os caminhos referem-se ao host histórico `www.imaginecomunicacao.com.br`. Não presumir que todas as URLs ainda retornam HTTP 200 ou estão indexadas atualmente; parte da evidência foi obtida de links e cache público.

## Achados de conteúdo e risco
- As páginas históricas de Google Ads e criação de sites fazem afirmações de certificações e desempenho que não devem ser migradas sem documentação e validação atuais.
- Loja virtual, YouTube Ads, LinkedIn Ads e marketplaces têm intenções distintas dos seis serviços aprovados no Astro. Não apontar esses caminhos para serviços próximos apenas por similaridade de palavras.
- O site antigo possui termos e privacidade em inglês, com descrição de dados pessoais, cookies e fornecedores; preparar política atualizada com assessoria jurídica antes de trocar qualquer URL desse tipo.
- A migração exige inventário complementar com Search Console, sitemaps, links externos, HTTP/status e trilha de aprovação por URL.

## Testes adicionados
- O manifesto agora contém **cinco candidatas** e **dez URLs HOLD**. Nenhuma regra está aprovada ou operacional.
- CI faz simulação local Cloudflare com cinco HTTP 301 de candidatos, duas páginas públicas válidas HTTP 200 e onze 404 (dez HOLD + URL inexistente).
- Artefatos CI continuam intitulados REVIEW-ONLY. Não há `public/_redirects` ou alteração DNS.

## Fontes públicas consultadas
- https://www.imaginecomunicacao.com.br/
- https://www.imaginecomunicacao.com.br/o-que-fazemos/criacao-de-sites-institucional.html
- https://www.imaginecomunicacao.com.br/o-que-fazemos/criacao-de-loja-virtual.html
- https://www.imaginecomunicacao.com.br/o-que-fazemos/google-ads-anuncios.html
- https://www.imaginecomunicacao.com.br/o-que-fazemos/facebook-instagram-ads.html
- https://www.imaginecomunicacao.com.br/o-que-fazemos/youtube-ads-anuncios.html
- https://www.imaginecomunicacao.com.br/o-que-fazemos/linkedin-ads-anuncios.html
- https://www.imaginecomunicacao.com.br/o-que-fazemos/marketplace-amazon.html
- https://www.imaginecomunicacao.com.br/o-que-fazemos/marketplace-mercado-livre.html

Sem publicar redirects ou mover o domínio.
