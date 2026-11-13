# F254 — Revisão da configuração Docker Compose interpolada, antes do staging

## Por que a F253 não bastava?

A F253 fixa exatamente o código-fonte de `compose.yaml` e `nginx.conf`. Entretanto, o Docker Compose resolve variáveis, converte a sintaxe curta de portas/volumes, atribui os caminhos do host e compõe o modelo efetivo. Um operador deve examinar o **modelo resultante** antes do `up`. Este é um gate adicional, não uma prova de VPS ou autorização de lançamento.

O comando oficial `docker compose config --format json` apresenta o modelo resolvido localmente; isso **não inicia contêineres**.

## Procedimento exclusivamente para o operador autorizado

Trabalhando na raiz do repositório, com o código e os arquivos locais devidamente revisados e com `IMAGINE_STAGING_NGINX_IMAGE` e `IMAGINE_STAGING_HTPASSWD_PATH` definidos num ambiente privado:

```sh
node scripts/check-reviewed-staging-config.mjs
docker compose -f ops/staging/compose.yaml config --format json \
  | IMAGINE_PRIVATE_STAGING_REVIEW=1 node scripts/check-effective-staging-compose.mjs
```

O segundo comando consome **exclusivamente stdin** (até 64 KiB, UTF-8 estrito) e compara o modelo resolvido com as variáveis do próprio operador. Não imprime os caminhos, as referências de imagem, senhas ou JSON; não grava arquivos, executa Docker, envia dados ou altera DNS. A variável `IMAGINE_PRIVATE_STAGING_REVIEW=1` apenas permite realizar a revisão, **não** permite qualquer deploy. O comando recusa execução em `GITHUB_ACTIONS=true`.

Os testes sintéticos da F254 cobrem:
- somente serviço `static-review`, imagem unprivileged fixada por SHA-256 e rede interna padrão;
- única porta TCP `127.0.0.1:4321:8080`, sem modo host ou serviço adicional;
- UID/GID `101:101`, filesystem read-only, capabilities `ALL` removidas, `no-new-privileges`, sem restart automático, limites CPU/RAM/PIDs;
- três bind mounts exatos e somente leitura (build compilado, Nginx revisado, arquivo de autenticação externo); recusa outros destinos, origens e volumes de escrita;
- tmpfs restritos e somente `TZ=UTC` no contêiner, evitando variáveis privadas injetadas;
- falha para modelos incompletos, campos operacionais adicionais, portas públicas, tags mutáveis, auth trocada e parâmetros de rede externos.

O parser é deliberadamente conservador e pode recusar campos novos de versões futuras do Docker Compose; nesse caso a saída é **HOLD**, não uma razão para desativar o gate. Revisar a diferença com um responsável técnico e acrescentar testes negativos antes de atualizar a política.

## O que **não** comprova

O JSON retornado pelo Compose é **uma prévia do que seria enviado ao Docker Engine**, não uma inspeção do contêiner realmente executado. Ainda é necessário verificar a própria imagem por digest/proveniência, mounts efetivos e configurações Nginx dentro do contêiner, exposição da porta no host, rede/SSH/TLS, autenticação, respostas 401/200/404, pacotes SHA e backups/rollback com um operador habilitado.

Nenhuma credencial real, imagem, JSON com paths privados, IP da VPS ou saída do Compose deve ser enviada a issues/PRs/artefatos de CI públicos. A F254 não aprova `main`, domínio, 301, API CRM, captação, produção ou despesas.
