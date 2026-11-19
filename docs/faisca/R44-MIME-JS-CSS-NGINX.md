# Faísca R44 — garantir MIME de scripts Astro e CSS no staging Nginx

**Base:** Faísca R43 [#507](https://github.com/rafhael100/imagine-comercial/pull/507) e correções R41 (iframe/XFO) e R42 (troca de serviço). **Status:** staging privado, PR draft, sem deploy/VPS.

## Falha potencial de experiência no staging

O smoke R43 prova que o Nginx serve arquivos HTML, JavaScript, CSS, SVG e demais assets **byte a byte iguais ao manifesto**. Mas **bytes iguais não são suficientes para executar um módulo JavaScript no navegador**: se o servidor responder `text/plain` ou `application/octet-stream` para um arquivo JS, o Chromium pode bloquear imports de módulo por MIME incorreto, e a conversa do Faísca pode não iniciar.

A configuração de staging até R43 não declarava `mime.types` explicitamente no próprio `server`, dependendo de o `http{}` externo fornecido pela imagem Nginx escolhida conter tipos MIME adequados. O Compose ainda exige uma imagem por digest escolhida pelo operador; portanto essa herança **não está comprovada nem fixada** na candidata.

Em um wrapper Nginx mínimo e isolado em localhost (sem mapeamento MIME no `http{}`), os testes de byte/CSP R43 passaram, mas o teste MIME adicional mostrou scripts e CSS com `Content-Type: text/plain` — **69/111 arquivos atendiam ao contrato MIME**, sem que houvesse adulteração dos bytes.

## Entrega R44

- `ops/faisca/staging/nginx.conf`: inclui explicitamente `/etc/nginx/mime.types` dentro do `server{}` e define `default_type application/octet-stream`. A falta do arquivo MIME na imagem fará o Nginx **falhar ao iniciar**, em vez de silenciosamente devolver scripts como texto. O arquivo precisa ser revisado como parte do digest da imagem unprivileged, ainda não escolhida.
- `ops/faisca/staging/verify-kit.mjs`: exige essas duas diretivas além de autenticação, XFO/CSP, GET/HEAD, loopback e `$request_uri`.
- `tests/faisca-r38-private-staging-kit.test.mjs`: simula a retirada de `mime.types` com o manifesto SHA-256 recalculado e exige rejeição por regra de política.
- `tests/faisca-r44-mime-contract.test.mjs`: verifica a presença única da tabela MIME e a cobertura de extensões pelo smoke real.
- `ops/faisca/staging/check-nginx-loopback.py`: ao inspecionar todos os arquivos via HTTP, além de 200/404, NOINDEX, ausência de cookies, bytes e SHA-256, exige `Content-Type` correto por extensão. Para JS, permite `application/javascript` ou `text/javascript`; para CSS, `text/css`; para HTML, `text/html`; inclui texto, XML e PNG.

## Prova local de configuração

O mesmo kit corrigido R41 foi usado em testes locais temporários com Nginx real, sem acesso à VPS:

- sem tabela MIME herdada ou incluída: **69/111 arquivos com MIME correto**; entre os incorretos, módulos JS e CSS;
- acrescentando explicitamente `include /etc/nginx/mime.types;` à configuração temporária do servidor: **111/111 arquivos com MIME correto** e SHA-256/bytes exatos;
- todos os **11/11 cenários de segurança HTTP R41** continuam verdes.

Esses números são **provas de laboratório local** sobre uma cópia temporariamente ajustada, não prova de compatibilidade com a imagem Nginx que será escolhida para Leaseweb. A CI deve gerar um novo kit com a versão R44 exata e, quando houver Nginx e `htpasswd` no runner, executar os testes de HTTP vivo de novo.

## Gate operacional

Não ativar produção a partir dessas provas. Ainda são necessárias: imagem Nginx unprivileged por digest realmente revisada (com `/etc/nginx/mime.types`), teste de configuração efetiva do container/Compose, autenticação bcrypt externa com permissões corretas, TLS/túnel e IAM, backups/restauração, revisão AppSec, integração de pedido e LLM com limites aprovados.

Nenhum merge main, deploy, DNS/VPS, cobrança, dados reais, CRM, PSP, fornecedor pago ou alteração do mascote aprovado.
