# F256 — Verificar o contêiner de staging **realmente em execução**

F253 valida o YAML/Nginx aprovado. F254 valida o JSON planejado pelo Docker Compose. F255 usa o parser real em CI sintética. A F256 acrescenta um passo que inspeciona **campos de configuração do contêiner que o Docker Engine declara estar executando** — somente leitura, após um operador legítimo iniciar o staging privado.

## Comando exclusivo do operador autorizado

Depois de completar F253–F255, configurar as variáveis privadas exigidas e **somente após a inicialização manual previamente aprovada do contêiner de staging**, a partir da raiz do repositório:

```sh
IMAGINE_PRIVATE_STAGING_REVIEW=1 node scripts/inspect-running-private-staging.mjs
```

O comando não pede senha, não faz HTTP e **não inicia Docker**. Em sequência: (1) fixa o Compose/Nginx do repositório pela F253; (2) invoca `docker compose config --format json` e revisa o modelo F254; (3) consulta `docker compose ps -q static-review` e exige exatamente um ID; (4) invoca `docker inspect --type container <ID>` **somente para leitura**; (5) revisa campos críticos usando F256. Não imprime ID, IP, caminhos, imagem, credenciais, env, JSON ou informações do Docker em logs. Recusa GitHub Actions e qualquer execução sem `IMAGINE_PRIVATE_STAGING_REVIEW=1`.

## Critérios examinados no estado real

- Contêiner marcado como **running**, não paused/dead/restarting; pertence ao serviço `static-review` e à localização esperada do projeto Compose.
- Imagem declarada por digest revisado, usuário `101:101`, filesystem root somente leitura e sem `Privileged`.
- `CapDrop=ALL`, ausência de `CapAdd`, `no-new-privileges`, recursos CPU/RAM/PIDs limitados e `restart=no`.
- Única porta publicada, `127.0.0.1:4321 -> 8080/tcp`, conferida em `HostConfig.PortBindings` **e** `NetworkSettings.Ports`; não permite publicação automática de portas nem binding IPv6/público.
- Três mounts de arquivos revisados: `dist`, `nginx.conf` e htpasswd externo, cada um do diretório aprovado e com `RW=false`, sem volumes adicionais.
- Exatamente uma rede Compose padrão (sem network mode host/bridge direto nem rede extra). Não imprime redes/IP reais.
- Rejeita env de credenciais Imagine, AWS, URL de banco, token ou segredo evidentemente injetados. Variáveis herdadas da imagem ainda precisam de revisão independente.

## Limitações: NO-GO mesmo com relatório positivo

`docker inspect` reflete o estado declarado pelo Docker daemon. **Não comprova** firewall do host, acesso remoto, TLS/SSH, provenance real do digest e CVEs, Nginx ativo e seu `nginx -T`, autorização MFA, leitura efetiva do bcrypt sob UID 101, integridade do pacote independentemente fixada, backups, política de rede do provedor, rollback nem entrega Portal→CRM. Um `inspect` isolado também não substitui a inspeção operacional no host e uma testemunha independente.

Após F256, ainda é obrigatório o ensaio HTTP privado completo da F167 com 401 anônimo para todas as rotas, parity de bytes HTML/CSS/JS/SEO, proteção noindex de staging e confirmação independente de integridade (F165). O domínio público, DNS, 301, captação, `main` e deploy continuam bloqueados até todos os aceites.

Nenhuma informação privada do host ou relatórios integrais deve ser copiada para GitHub público; registrar apenas as conclusões redigidas e IDs de evidência com acesso restrito.
