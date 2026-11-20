# Faísca R111 — cabeçalhos HTTP ambíguos no laboratório privado

**Status:** DRAFT / revisão somente. Base isolada: R110 #585, SHA `9988fc51de5e8790c0f861b22df115d9852920df`.

## Risco reproduzível

O parser HTTP/1.1 do Node pode conservar apenas a primeira ocorrência de `Host` e `Authorization` no objeto `req.headers`, embora `req.rawHeaders` contenha as duas. Um request com `Host` ou `Authorization` correto seguido de versão conflitante podia atravessar a validação que consultava somente `req.headers`. Mesmo com a porta restrita a 127.0.0.1 e bearer, um cliente local ou proxy mal configurado não deve criar contexto de autenticação ambíguo antes do gasto com a API.

## Alteração e provas

- Inspeção de `rawHeaders` antes de servir assets privados GET e antes de autenticar endpoints POST, rejeitando duplicação de `Host`, `Origin`, `Authorization` e cabeçalhos de corpo/framing.
- `Forwarded`, `X-Forwarded-*` e `X-Real-IP` são proibidos no endpoint exclusivamente loopback: staging exposto por proxy não vira implicitamente um serviço autorizado.
- `tests/faisca-r111-private-http-singleton-headers.test.mjs` usa TCP/HTTP real com headers duplicados e metadados de proxy, espera 403 antes de invocar fixture sintética, e prova o controle positivo (POST 200 com fonte R06 e GET 200 da interface).
- Regressões HTTP, Node, Chromium/axe, Onepage/Portal, PHP, PostgreSQL descartável e Comercial/SEO devem ser verificadas na HEAD exata pelo GitHub Actions. CI verde não constitui revisão AppSec independente.

## Dependências e gates

Manter a revisão independente dos contratos R95–R110, ledger persistente e staging privado a cargo de operador autorizado. R92 foi relatada como homologada; **R95–R111 não foram instaladas nesta execução**. Não acessar chave nem credenciais, não repetir testes reais pagos sem ambiente provisionado, não promover a interface privada a chatbot público.

`publicFaiscaEnabled=false` e `main` intactos. Sem merge, deploy, DNS/VPS, mudanças no site público, dados reais, CRM/Portal operacional, lead, ticket ou cobrança.
