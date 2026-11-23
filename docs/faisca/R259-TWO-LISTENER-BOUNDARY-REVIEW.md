# R259 — dois listeners privados, revisão atômica (DRAFT)

## Implementação

Compor as validações R257 (23 GET/HEAD/OPTIONS sem credenciais em
127.0.0.1:4337; runtime Docker somente **relatado**) e R258
(quatro GET/OPTIONS anônimos em 127.0.0.1:4336, API privada R95).
Somente emitir um relatório quando as 27 sondas forem satisfatórias.
Falha no Nginx interrompe antes de tocar a API; divergência no segundo
relatório gera HOLD e jamais um resultado positivo parcial.

O código não executa Docker, SSH, deploy, alteração DNS, POST, chamadas
pagas OpenAI, consulta a credenciais nem qualquer ação CRM/Portal/Sites.
A CI usa apenas dados fictícios e o servidor R95 com provedor simulado.

## Operação privada sob autorização própria

Usar checkout limpo pinado por SHA revisada de forma independente.
O operador fornece por stdin o mesmo JSON de R257:
um objeto com chaves "container" e "image", cada uma com um array
contendo exatamente um registro da inspeção Docker previamente aprovada.
Não armazenar o JSON em GitHub, artifacts, tickets ou logs.

Invocar node scripts/faisca-review-two-listener-boundary.mjs somente em
ambiente autorizado, com IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW=1
e IMAGINE_FAISCA_NGINX_IMAGE (pin confiável externo),
IMAGINE_FAISCA_STAGING_WORKDIR, IMAGINE_FAISCA_STAGING_SITE_DIR,
IMAGINE_FAISCA_STAGING_HTPASSWD_PATH iguais às da R257.
O CLI bloqueia argumentos, CI, GitHub Actions e corpo acima de 512 KiB.
O pin da imagem deve ser externo e independente do próprio JSON.

## Limitações e gates

O sucesso dos checks anônimos não prova propriedade dos processos Docker,
vínculo real entre interfaces :4336 e :4337, ausência de acesso externo,
homologação de conversa autenticada, instalação da R95 na VPS, gasto
efetivo ou autorização de produção. Nenhum campo de GO é verdadeiro.

Manter R92 e testes Luna/Terra já relatados sem repetição.
Próximos gates: comprovar vínculo de processos/portas no ambiente alvo
autorizado; smoke da conversa privada autenticada com dados fictícios;
conciliar gasto de fonte independente; revisões AppSec/LGPD/FinOps/editorial.
Preservar main, site público, mascote e publicFaiscaEnabled=false.
Sem merge, deploy, DNS/VPS, cobrança, lead, ticket ou dados reais.

Testar localmente com:
node --test tests/faisca-r259-two-listener-boundary.test.mjs

Revisar também CI completa (Node/HTTP/Chromium/axe, SEO/build,
compatibilidade Onepage/Portal, PHP e PostgreSQL descartável) na
HEAD exata da PR.