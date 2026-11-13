# F167 — Um único diagnóstico do candidato de staging (sem deploy)

O operador do futuro staging Leaseweb precisaria executar separadamente as verificações de imagem, conteúdo, arquivo de autenticação e HTTP. Agora `scripts/review-private-staging-operator.mjs --port=4321` reúne os quatro módulos **existentes** e produz um relatório JSON sem credenciais, URLs privadas, corpos HTTP ou PII.

## Gate composto

1. F164: imagem Nginx unprivileged referenciada por digest SHA-256 de sintaxe válida, sem comprovar assinatura/proveniência.
2. F165: correspondência byte a byte do `dist` completo com `IMAGINE_EXPECTED_STAGING_TREE_SHA256` obtido por canal independente, sem provar a legitimidade do canal.
3. F166: arquivo externo `.htpasswd` com usuário `reviewer`, bcrypt e permissões locais restritas, sem provar autenticação do operador, MFA ou leitura efetiva pelo UID 101.
4. F159/F166: via **127.0.0.1**, exige HTTP 401 sem credenciais e então **22** respostas GET autenticadas, com quatro páginas 200, 18 URLs legadas HOLD em 404 e cabeçalhos F28.

A ordem é obrigatória: **qualquer erro local impede toda requisição HTTP**. Uma resposta inesperada ou redirecionamento falha fechado. O relatório mostra contagens, flags e blockers sempre falsos para capacidade operacional: `canCollectPublicLeads=false` e `deploymentAuthorized=false`.

## Execução futura, apenas por operador habilitado

Após provisionar e autorizar um staging com acesso local/SSH e sem saída pública, preparar no ambiente privado as variáveis `IMAGINE_PRIVATE_STAGING_REVIEW=1`, `IMAGINE_STAGING_NGINX_IMAGE`, `IMAGINE_EXPECTED_STAGING_TREE_SHA256`, `IMAGINE_STAGING_HTPASSWD_PATH` e `IMAGINE_STAGING_REVIEW_PASSWORD`. Executar `node scripts/review-private-staging-operator.mjs --port=4321`. Nunca colocar valores secretos em Git, env versionado, mensagens públicas ou histórico. O CLI **recusa GitHub Actions** para que não consulte acidentalmente um staging real.

A suíte de CI testa o gate com estrutura sintética, teste real de bytes em diretório descartável, resposta mock com 401 e 22 verificações, além de sabotagem de imagem, HTML, permissões e login. Não conecta à Leaseweb, não inicia contêiner nem envia dados reais.

## Faltam condições materiais

Acesso administrador à VPS, proveniência independente de imagem e hash, rede/TLS/MFA de operador, execução real do contêiner, revisão AppSec/DBA/LGPD, release versionado, F70 contato/CRM durável e aprovação humana de publicação. Nenhuma dessas condições foi declarada concluída por este diagnóstico.
