# Faísca R236 — conferência read-only dos campos do contêiner privado realmente existente

## Motivo

R234 valida a configuração-fonte incluída no kit e R235 valida o modelo resolvido de Docker Compose. Ainda falta confrontar essas expectativas com o que um **Docker daemon autorizado relata** sobre o contêiner realmente existente. Os três níveis são complementares; nenhum, isoladamente, autoriza publicação.

## Entrega

`ops/faisca/staging/review-running-container.mjs` confere um único registro `docker inspect` em memória. Exige serviço `faisca-review` sob Compose único, imagem Nginx unprivileged SHA-256 esperada, usuário 101:101, contêiner running, porta TCP `127.0.0.1:4337 → 8080` tanto em configuração como em NetworkSettings, rede de projeto padrão, três mounts `:ro` exatamente previstos, `no-new-privileges`, capabilities removidas, filesystem readonly, limites de 256 MiB/0,5 CPU/64 PIDs e ausência de valores de ambiente sensíveis.

`scripts/faisca-review-running-container.mjs` aceita exclusivamente JSON pipado de **um** contêiner no modo privado do operador, no máximo 256 KiB UTF-8 válido, sem executar Docker, SSH, HTTP ou alterar o host. Em falha retorna **HOLD** sem ecoar imagem, paths, rede ou ambiente. Recusa explicitamente GitHub Actions. `tests/faisca-r236-running-inspect.test.mjs` exercita controles positivos e negativos.

Teste de laboratório:

```bash
node --test tests/faisca-r236-running-inspect.test.mjs
npm test
npm run test:browser
```

O operador pode posteriormente, com acesso **próprio e especificamente autorizado**, obter um registro de seu contêiner já iniciado com `docker inspect --type container <ID>` e passar o JSON por stdin para a CLI, fornecendo as variáveis privadas e independentes `IMAGINE_FAISCA_NGINX_IMAGE`, `IMAGINE_FAISCA_STAGING_SITE_DIR`, `IMAGINE_FAISCA_STAGING_HTPASSWD_PATH` e `IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW=1`. Não copiar para issue/PR o JSON bruto, `env`, paths ou hashes privados. **Não buscar nem reutilizar credenciais**.

## Gates não concluídos

Não houve acesso à VPS/daemon nesta entrega. O auditor não verifica firewall externo, DNS, TLS, assinatura/origem da imagem, configuração efetiva de `nginx -T`, autenticação de ponta a ponta, byte-parity HTTP, instalação R95, reconciliação externa de custo ou revisões AppSec/LGPD/editorial. A R92 e os testes pagos Luna/Terra previamente relatados não foram repetidos. Manter `main`, mascote, site público e `publicFaiscaEnabled=false` inalterados. Sem merge/deploy, VPS/DNS, integrações reais Portal/CRM/Sites, lead, ticket ou cobrança. **NO-GO público.**
