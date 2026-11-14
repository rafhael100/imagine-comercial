# F168 — Staging privado: autenticação obrigatória em 26 rotas

## Problema resolvido

A F166 verificava o acesso sem senha **somente à homepage**. Uma configuração Nginx com autenticação incompleta poderia bloquear `/` e deixar uma página legada, um artigo, `robots.txt`, `sitemap.xml` ou uma URL de asset acessível sem senha. A F168 amplia o diagnóstico HTTP real, sem autorizar deploy.

## Cobertura

Quando `basicAuth` é fornecido pelo operador privado, `reviewPrivateStagingHttp` agora executa, **antes de qualquer requisição autenticada**, exatamente **26 GETs anônimos** no socket `127.0.0.1`: 4 páginas de negócios, as 18 rotas legadas `HOLD` e mais 4 rotas de controle (robots, sitemap, FAQ e uma URL sintética `_astro` de asset). Cada resposta precisa ser **401**, apresentar desafio `WWW-Authenticate: Basic`, `X-Robots-Tag` incluindo `noindex` e `Cache-Control` incluindo `no-store`. 200, 301, 302, 404, falta de headers, redirect ou erro de rede impedem o teste autorizado.

O 404 HTML interno do Nginx não integra a lista: `location = /404.html { internal; }` pode legitimamente retornar 404 diretamente antes de autenticar. Em vez disso, testamos a rota pública de FAQ e um asset virtual. Com os 26 acessos protegidos, o diagnóstico executa os **22 GETs autenticados** anteriores: quatro páginas HTML com canonical e 18 URLs legadas sem indexação, ambas com os headers F28.

A F167 composta passou a exigir `unauthenticatedRoutesDenied === 26` e mostra somente essa contagem, sem imprimir senha, cookie, URL privada ou corpo HTTP. O teste Workerd isolado sem `basicAuth` mantém seu escopo original e nunca é confundido com homologação segura.

## Testes e limites

Testes Node sabotam individualmente uma URL de negócio, uma legada, robots, sitemap, FAQ e asset, simulando exposição 200/404 e ausência de `WWW-Authenticate`, `noindex` ou `no-store`. Nenhum caso de falha pode iniciar a etapa com autorização. Os dados são sintéticos e não existe chamada à Leaseweb, nem criação de contêiner, DNS ou endpoint público.

Mesmo que **26/26 + 22/22** passem em localhost real no futuro, ainda serão necessárias auditoria de TLS/túnel SSH/rede, MFA, configuração Nginx efetiva, imagem por digest com proveniência, F70 Portal→CRM, LGPD e aprovação explícita do release.
