# Faísca R235 — auditoria do Compose já resolvido (staging privado, NO-GO público)

## Lacuna objetiva

A R234 protegeu as diretivas do `compose.yaml` e `nginx.conf` incluídas no kit de revisão. Isso **não comprova o modelo efetivo** de Docker Compose após expansão de variáveis de ambiente e possíveis arquivos adicionais. Porta aberta ao mundo, outro serviço, `network_mode: host`, `privileged`, comandos alternativos ou volumes graváveis não devem ser aceitos apenas porque o YAML do pacote tinha uma versão revisada.

## Entrega executável

- `ops/faisca/staging/review-effective-compose.mjs`: auditor puro que recebe modelo JSON do `docker compose config --format json` e três caminhos absolutos **independentemente revisados** (site, Nginx e htpasswd) mais a imagem Nginx pinada por SHA-256. Aceita apenas serviço `faisca-review`, porta `127.0.0.1:4337:8080`, imagem `nginxinc/nginx-unprivileged@sha256:...`, usuário `101:101`, sem privilégios, mounts específicos `:ro`, orçamento de CPU/memória, rede default local e variáveis explicitamente permitidas.
- `scripts/faisca-review-effective-compose.mjs`: CLI **somente operador**, lê JSON UTF-8 de stdin com limite de 64 KiB, sem executar Docker, coletar credenciais, abrir conexões ou criar arquivos. Erros e resultados não imprimem paths, imagem ou conteúdo.
- `tests/faisca-r235-effective-private-compose.test.mjs`: casos positivos de normalização Docker V2 e negativos de portas, serviços, privilégios, overrides, bind mounts, segredos, entrada inválida e uso em CI.
  
Para os testes de laboratório:

```bash
node --test tests/faisca-r235-effective-private-compose.test.mjs
node --test tests/faisca-r38-private-staging-kit.test.mjs
npm test
npm run test:browser
```

**Conceito de revisão operacional, não executado na VPS:** um operador autorizado, após fixar os hashes da fonte e validar paths e imagem em canal independente, poderá inspecionar **sem subir nenhum contêiner** com:

```bash
docker compose -f ops/faisca/staging/compose.yaml config --format json | IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW=1 node scripts/faisca-review-effective-compose.mjs
```

Exige `IMAGINE_FAISCA_NGINX_IMAGE`, `IMAGINE_FAISCA_STAGING_SITE_DIR`, `IMAGINE_FAISCA_STAGING_HTPASSWD_PATH` já fornecidos ao operador em ambiente privado; não publicar valores ou saída bruta do Docker. A verificação evita eco de ambientes, mas **não atesta que as variáveis foram obtidas de fonte independente**. O operador precisa conferir hashes/pins fora do próprio pacote e confirmar o contêiner efetivo com inspeção read-only, `nginx -T`, teste HTTP 401/403, ausência de portas externas e reconciliação financeira.

## Limites e bloqueios

CI verde e análise do JSON **não comprovam** ambiente instalado, origem da imagem, containers em execução, TLS, rede, backups, consumo real, identidade, LGPD, qualidade editorial, integração Portal/Sites ou segurança de respostas reais. Os testes pagos Luna/Terra e a R92 já relatada permanecem respeitados e **não são repetidos**. A R95 e o acúmulo R95–R235 não são presumidos na VPS. Preservar `main`, mascote, site público, `publicFaiscaEnabled=false`; sem deploy, merge, DNS/VPS, CRM/Portal/Sites operacional, lead, ticket ou cobrança. **NO-GO público.**
