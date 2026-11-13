# F253 — Bloqueio de alterações perigosas em Nginx e Docker Compose do staging privado

## Problema eliminado

A pré-checagem F164 verificava existência e permissões dos arquivos de configuração, a imagem por sintaxe de digest, a senha bcrypt privada e a integridade do build, mas **não comparava a configuração inteira** do contêiner e do servidor Nginx. A presença dos trechos corretos não é suficiente: um `ports:` adicional, serviço paralelo ou `location` com `auth_basic off` pode sobrepor ou contornar garantias de privacidade.

## Implementação

A F253 introduz `src/lib/private-staging-config-lock.mjs` com **expectativas versionadas de cada linha executável**, conservando indentação, hierarquia e ordem. Comentários e linhas em branco são ignorados; qualquer alteração de diretiva ou YAML falha **HOLD**. O limite de 16 KiB e validação ASCII/LF recusam arquivos inválidos.

Ambos os comandos restritos ao operador invocam o bloqueio **antes de utilizar um ambiente privado**:
- `scripts/check-private-staging-prerequisites.mjs` — preflight F164, ainda exige autorização de revisão, diretório `dist`, pin independente, bcrypt e imagem real por digest.
- `scripts/review-private-staging-operator.mjs` — gate F167, recusa pular a validação inicial e executar sua inspeção HTTP com source divergente.

O novo comando `node scripts/check-reviewed-staging-config.mjs` oferece um diagnóstico **sem senha, sem Docker e sem rede**, adequado a CI e ambientes de desenvolvimento. Foi inserido no workflow de SEO/build/navegador. A saída informa exclusivamente flags agregadas e nega autoridade de release.

Os testes F253 alteram a configuração de forma adversarial: porta pública, segundo serviço/porta, `read_only: false`, root UID, capabilities, bind writeable, ausência de auth, `auth_basic off` em location sobreposta, POST, logging e `proxy_pass`. Os casos devem falhar mesmo que a configuração continue contendo todos os trechos positivos de segurança.

## Limite de evidência

Esta é a **integridade de origem da configuração, não a integridade operacional**. O Docker Engine pode carregar uma configuração interpolada, imagem, volumes ou rede que não correspondam ao repositório. A revisão independente precisa validar `docker compose config`, imagem efetivamente obtida por digest e proveniência, acesso real via loopback/túnel SSH, TLS, headers, respostas 401/200/404, permissões, backups e rollback.

Mudanças legítimas no Compose/Nginx exigem revisão independente e atualização deliberada da expectativa versionada, nunca desativação do teste. Os resultados desta F253 não habilitam domínio público, DNS, 301, API CRM, captação, gastos, `main` ou deploy.
