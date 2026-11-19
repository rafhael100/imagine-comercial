# F255 — Parser Docker Compose real com modelo sintético em CI

A F254 validava um modelo JSON estruturado **sintético** de `docker compose config --format json`, mas isso não comprovava paridade com a versão da ferramenta no executor Ubuntu do GitHub Actions.

A F255 adiciona à CI do site Comercial, antes de instalar dependências npm, a etapa:

```sh
node scripts/test-real-docker-compose-config-ci.mjs
```

O script é permitido **somente** quando `GITHUB_ACTIONS=true` e recusa variáveis reais de staging no processo. Ele invoca exatamente `docker compose -f ops/staging/compose.yaml config --format json`, com uma referência de imagem sintética por digest e um caminho de autenticação sintético que não precisa existir. Não invoca `docker pull`, `up`, `run`, não abre rede, não lê a senha, não persiste JSON nem inicializa contêiner. A saída fica restrita a indicadores booleanos de CI, sem expor paths e hashes.

O JSON produzido pelo parser Docker Compose **real do runner** é comparado usando `reviewEffectivePrivateStagingCompose` (F254): porta localhost única, UID e capabilities, filesystem read-only, três volumes exatos RO, tmpfs, limites e ausência de campos elevados ou serviços extras. Se a versão do Docker Compose introduzir um campo novo ou normalizar uma opção diferentemente, **a CI falha** e exige revisão deliberada do contrato.

## Evidência e limites

Este teste não usa imagem real nem contêiner em execução e não substitui o F253 (source lock), F254 (preflight do operador com seu modelo efetivo), autenticação real, HTTPS/SSH, pin independente, verificação da rede Leaseweb ou o processo de release. É uma prova de compatibilidade **do parser**, não de aplicação operacional.

Não modifica `main`, DNS, 301, checkout, site público, CRM, dados pessoais nem servidores.
