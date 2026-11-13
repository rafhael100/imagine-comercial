# F166 — Staging privado exige autenticação, não apenas localhost

O staging RC38 já tinha contêiner unprivileged, porta 127.0.0.1, sistema read-only, header `noindex` e SHA da árvore F165. Mas qualquer processo que alcançasse o socket local ou um túnel configurado pelo operador poderia ler o HTML, sem autenticação adicional.

## Implementado

1. `ops/staging/nginx.conf` exige HTTP Basic de usuário fixo `reviewer`. O contêiner só encontra os hashes via bind mount **read-only** de `IMAGINE_STAGING_HTPASSWD_PATH` apontando para arquivo **externo** ao repositório e gerado pelo operador. Não há senha nem hash de credencial versionados.
2. O pré-voo `reviewPrivateStagingHtpasswd` checa caminho absoluto sem traversal/injeção, arquivo regular não-symlink, permissões sem acesso público nem escrita de grupo, e **formato** de bcrypt com custo 10–15 e usuário exato. O conteúdo não aparece no relatório. A leitura efetiva pelo UID/GID 101 e a legitimidade do hash dependem do operador e do contêiner real.
3. O diagnóstico HTTP `reviewPrivateStagingHttp` recebe credencial sintaticamente validada apenas da execução confiável do operador, **primeiro exige HTTP 401 sem qualquer Authorization** e só depois executa as 22 verificações HTTP autenticadas. A chamada Workerd local sem autenticação continua suportada e não concede autoridade de release.
4. O CLI exige `IMAGINE_STAGING_REVIEW_PASSWORD` por ambiente seguro e nunca imprime senha, hash, URL de acesso ou cabeçalhos privados.
5. Testes Node cobrem permissões, hashes/paths inválidos, falta de arquivo, 401/200/404, senha errada, formato Basic inválido, ausência de vazamento de segredo e flags de `deploymentAuthorized=false`.

**Apenas defesa de staging:** Basic Auth em HTTP **nunca deve ser usado em rede aberta**. A porta deve permanecer em localhost, com eventual acesso remoto somente por túnel SSH legítimo, e TLS, MFA, rede restrita, gestão de segredos, identidade e revisão AppSec continuam pendentes. Não há instalação, inicialização Docker, acesso Leaseweb, DNS, lead, tráfego público ou deploy nesta entrega. O formulário F70/CRM real segue bloqueado.
