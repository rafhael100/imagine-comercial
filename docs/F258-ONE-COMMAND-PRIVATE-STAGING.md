# F258 — Uma única verificação de staging privado, sem publicar nem alterar serviços

As verificações F164, F253–F257 e F167 agora podem ser executadas em sequência por um **único comando de revisão**:

```sh
IMAGINE_PRIVATE_STAGING_REVIEW=1 node scripts/review-private-staging-chain.mjs
```

## Pré-requisitos de operador

A execução exige um ambiente autorizado e previamente isolado, com o contêiner de staging **já iniciado pelo operador habilitado**. Todas as variáveis privadas necessárias aos CLIs existentes devem estar definidas fora do GitHub:
- `IMAGINE_STAGING_NGINX_IMAGE`: digest da imagem Nginx unprivileged previamente revisado;
- `IMAGINE_STAGING_HTPASSWD_PATH`: caminho absoluto privado do bcrypt;
- `IMAGINE_EXPECTED_STAGING_TREE_SHA256`: pin de árvore do build obtido por canal independente;
- `IMAGINE_STAGING_REVIEW_PASSWORD`: senha efêmera forte, somente no processo do operador;
- `IMAGINE_PRIVATE_STAGING_REVIEW=1`: autorização exclusivamente para **diagnóstico**.

Nenhum valor dessas variáveis ou conteúdo de `dist` deve ser colado em issue pública, PR, log, comando de shell compartilhado ou conversa.

## Quatro etapas sequenciais

1. **F164 + F253 + F165 + F166** — configuração aprovada, pacote completo, pin SHA, sintaxe do digest e bcrypt/permissões localmente revisados.
2. **F256** — modelo Compose F254 e contêiner real em estado running: bindings, volumes, UID, caps e rede informados pelo Docker Engine.
3. **F257** — configuração Nginx carregada, por `nginx -T`, exatamente correspondente à versão revisada, sem segundo server/proxy ou includes extras.
4. **F167** — requisições HTTP estritamente para `127.0.0.1:4321`, exige negação 401 anônima e bytes/headers de cada página, URL legada, asset e SEO de acordo com o pacote fixado, com SHA revalidado após a sessão.

Se qualquer etapa falhar ou sua saída indicar alguma autorização indevida, o script aborta **HOLD** e informa somente o nome estático da etapa. Não imprime stdout/stderr bruto, paths, hash, Basic Auth, arquivos de configuração ou texto de resposta. Não grava JSON, não inicia/para/recria contêineres e recusa GitHub Actions.

Se todas as etapas retornarem evidências coerentes, o comando gera **apenas um resumo redigido** de quatro diagnósticos positivos com `deploymentAuthorized=false` e `canCollectPublicLeads=false`.

## Não confundir aprovação de diagnósticos com liberação

Mesmo um resultado positivo **não** estabelece: autenticidade de origem e CVEs da imagem, independência do pin, segurança da sessão SSH, firewall/roteamento/TLS externos, MFA, aprovação de operador independente, backups/rollback, integração Portal→CRM com recibo durável, aprovação AppSec/DBA/LGPD, equivalência SEO ou autorização de publicação. Todos continuam NO-GO até verificação separada.

Esta entrega não modifica `main`, domínio, DNS, 301, Cloudflare, Portal, CRM, consumo de fornecedores ou produção.
