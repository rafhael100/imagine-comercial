# Faísca R250 — aliases HTML e consultas não burlam autenticação privada

## Risco
A revisão HTTP R240–R249 protege cinco URLs canônicas, mas um erro de configuração Nginx poderia deixar `/index.html`, `/__faisca_preview/journey/index.html`, outras variantes de índice ou query acessíveis anonimamente enquanto a URL canônica continuava retornando 401. Para variantes, o `map $request_uri` revisado exige **X-Frame-Options: DENY** e `frame-ancestors 'none'`, e não o SAMEORIGIN de duas rotas exatas.

## Incremento
- Novo verificador `reviewFaiscaPrivateNoAuthAliases` usa a mesma requisição GET/HEAD loopback, deadline de 2.500 ms, limite de 8 KiB de cabeçalho e 2 KiB de corpo, autenticação ausente, CSP exata, controles anti-vazamento de R249.
- Testa **seis** requisições adicionais fixas a índices diretos, JS com query sintética e página com query sintética. Todos devem devolver **401**, noindex, no-store, DENY e `frame-ancestors 'none'`.
- O verificador não aceita host, URLs, cookies, chaves, paths ou comandos fornecidos por terceiros e não toca VPS, credenciais ou servidor real.
- Regressão: `node --test tests/faisca-r250-private-alias-auth.test.mjs`, abrangendo 401 verdadeiro, bypass 200 em somente uma rota, redirecionamento, CSP fraca, auth ausente e vazamento HTML. Executar a CI completa na HEAD exata.

## Escopo e limites
Este é teste **read-only** para servidor local: execução com fixtures sintéticas, sem prova de que Nginx/Docker está instalado na VPS ou acessível apenas no host; não avalia a experiência autenticada, origem independente do pacote ou gastos. Não modifica o Nginx operacional. R92 e chamadas pagas Luna/Terra anteriormente relatadas não serão repetidas. AppSec/LGPD/FinOps/editorial e homologação acumulada permanecem pendentes.

Base imutável: R249 #728, HEAD `fb6f74e923cb7ba0f4756f538e43c9cc4b9af6a8`, 6/6 workflows SUCCESS. Branch isolada e PR draft, sem merge, deploy, main, DNS/VPS, operações CRM/Portal/Sites, alteração do mascote/site público ou `publicFaiscaEnabled=false`. **NO-GO público.**
