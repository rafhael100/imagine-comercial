# Faísca R258 — perímetro HTTP anônimo da API privada

**DRAFT / REVIEW ONLY / NO-GO público.** A R257 cobre o contêiner de
revisão estática Nginx na porta 4337. A conversa fictícia R95, entretanto,
é servida por outro processo Node, na porta local 4336, que tem riscos
distintos de CORS e publicação de rotas. A R258 cria uma prova negativa
isolada, **sem enviar POST ou consumir créditos**.

## O que verifica

`reviewFaiscaPrivateApiAnonymousBoundary` faz quatro requisições fixas,
GET/OPTIONS para as rotas privadas de resposta fixa e conversa livre:
`/__faisca_openai_private/respond` e
`/__faisca_openai_private/converse`. O destino é **sempre
127.0.0.1**; a CLI de operação usa a porta 4336. Cada requisição leva
um Origin exclusivamente sintético para detectar vazamento de cabeçalhos
de CORS, mas **nunca** Authorization, cookie, bearer, pergunta ou corpo.

No contrato atual de R95, esses quatro métodos precisam devolver 404
com JSON exato `{"status":"not_found"}`, Cache-Control no-store,
Pragma no-cache, CSP `default-src 'none'`, noindex, nosniff e
Referrer-Policy restritiva. Qualquer redirecionamento, CORS positivo,
cookie, preload, conteúdo não aprovado, cabeçalho duplicado, resposta
grande, timeout ou erro gera **HOLD** sem divulgar URL, cabeçalhos ou
conteúdo. Deadline absoluto 2,5 segundos, 8 KiB de cabeçalhos e
256 bytes de corpo por requisição.

CLI: `scripts/faisca-review-private-api-noauth.mjs`, com
`IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW=1`, recusa de CI e argumentos.
Só um operador com autorização de ambiente deve executar quando a API
privada já estiver disponível localmente. Ausência de serviço é HOLD;
não instalar, iniciar, modificar ou concluir que R95 já foi homologada.

## Testes

`node --test tests/faisca-r258-private-api-noauth-perimeter.test.mjs`
executa os quatro pedidos contra o **servidor HTTP R95 real** com um
adaptador estritamente simulado, tanto com conversa habilitada quanto
desabilitada, e exige contador zero de chamadas ao provedor. Outra
fixture HTTP verifica CORS, redirecionamentos, códigos, corpo/headers
alterados e CLI. O teste não utiliza API key e não cria dados reais.

**Limites:** a revisão negativa não demonstra autenticação válida, fluxo
POST privado, identidade Docker/processo, exposição externa, faturas
Luna/Terra, instalação acumulada R95–R258 ou GO público. A revisão
R257 e este teste são evidências complementares; ambos exigem
homologação operacional e revisão humana independente antes de
liberação para clientes.

Preservar `main`, site e mascote e
`publicFaiscaEnabled=false`. Nenhum deploy, merge, acesso SSH,
DNS/VPS, CRM/Portal/Sites, dados reais, cobrança, lead ou ticket.
