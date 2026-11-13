# F257 — Verificar a configuração Nginx realmente carregada no staging

Depois dos gates F253 (arquivo fonte), F254/F255 (modelo Docker Compose) e F256 (contêiner declarado pelo Docker Engine), ainda existe o risco de o processo Nginx carregar **outros arquivos incluídos**, uma segunda definição `server`, ou um `default.conf` diferente do que o repositório aprovou.

A F257 adiciona um diagnóstico read-only destinado ao operador, a ser executado **somente** no staging privado já inicializado e depois de aprovados os gates anteriores.

```sh
IMAGINE_PRIVATE_STAGING_REVIEW=1 node scripts/check-running-private-nginx.mjs
```

O script exige a configuração de fonte F253, modelo resolvido F254, um único contêiner encontrado por `docker compose ps -q`, validação de estado real F256 via `docker inspect` e, finalmente, executa `docker exec <ID> nginx -T` — comando de **testar e imprimir configuração carregada**, sem recarregar, iniciar, parar ou alterar o processo. O resultado é interpretado em memória; conteúdo completo, paths, imagem e stderr do Docker jamais são publicados pelo CLI.

A revisão confere:
- o `default.conf` carregado por Nginx corresponde exatamente a **todas as diretivas executáveis** do arquivo versionado, preservando o sentido dos blocos e ignorando apenas comentários e linhas em branco;
- não há segundo `server`, outro `*.conf` incluído não aprovado ou diretiva `proxy_pass` oculta;
- a estrutura básica `nginx.conf` e `mime.types` é a esperada, sem `location`, `auth_basic`, `server_name` ou `listen` adicionais fora do `default.conf` revisado;
- arquivos inválidos, grandes, URLs ou injeções de configuração falham em **HOLD**, sem relaxar a revisão do contêiner.

O modelo é deliberadamente conservador. Se uma atualização legítima do Nginx introduzir outro arquivo incluído, o operador deverá revisá-lo e atualizar a política com novos testes antes de prosseguir; não é permitido simplesmente ignorar o resultado.

**O que ainda exige homologação independente:** `nginx -T` valida a configuração carregada que a ferramenta reporta, mas não as regras da borda da VPS, TLS/SSH, acesso anônimo em todas as URLs, cookies, headers, parity de bytes do build, DNS e disponibilidade do serviço. Por isso o comando F167 permanece obrigatório depois da F257, com pin de SHA independente e credenciais locais de revisão. Segredos e arquivos `.htpasswd` não devem ser enviados para GitHub.

A F257 não faz deploy, não autoriza `main` nem 301, não habilita CRM/Portal, checkout, leads ou produção.
