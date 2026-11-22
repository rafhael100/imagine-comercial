# Faísca R239 — identidade da imagem local (NO-GO público)

## Lacuna

R235 confere a referência pinada no Compose; R236–R238 conferem referência, portas, mounts e namespaces no contêiner. Faltava correlacionar o ID da imagem executada (digest de configuração OCI, container.Image) com a imagem cadastrada pelo daemon (image.Id), que declara um digest de manifesto em image.RepoDigests. Esses são **dois tipos de digest distintos**. A referência correta no campo Config.Image, isoladamente, não demonstra a identidade da imagem em execução.

## Entrega

- ops/faisca/staging/review-image-identity.mjs verifica container.Config.Image contra pin independente, container.Image === image.Id, exatamente o manifesto pinado em image.RepoDigests, Linux e amd64/arm64. Registros e referências divergentes causam HOLD.
- scripts/faisca-review-image-identity.mjs: operador privado fornece JSON limitado a 512 KiB, UTF-8 estrito, via stdin, como objeto contendo container:[um registro] e image:[um registro]. Não chama Docker, registry, HTTP, SSH ou VPS; não lê segredos, não cria arquivos, não emite IDs nem dados brutos. Recusa GitHub Actions.
- tests/faisca-r239-private-image-identity.test.mjs: casos positivos sintéticos e negativos de alteração de imagem, manifestos, aliases mutáveis, registros inválidos, acesso dinâmico e CLI segura.

Comando de laboratório: node --test tests/faisca-r239-private-image-identity.test.mjs. Validar também workflows Node/HTTP, Chromium/axe, SEO/build, Portal/Onepage, PostgreSQL descartável e PHP na HEAD exata.

## Operação futura privada (não executada)

Operador com acesso próprio e especificamente autorizado deverá, se necessário, coletar localmente um registro de docker inspect --type container para o contêiner privado já existente e um registro de docker image inspect para a imagem correspondente. O JSON combinado será alimentado na CLI apenas em estação privada, com IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW=1 e IMAGINE_FAISCA_NGINX_IMAGE **obtida por canal de confiança independente**; nunca copiar o pin do próprio JSON. Manter dumps e chaves fora do GitHub, CI, artifacts, tickets e chats.

Esta verificação só prova **coerência entre alegações locais fornecidas**, não autentica o daemon, a origem do pin ou o manifest registry, nem verifica assinatura, SBOM, CVEs, isolamento real ou servidor configurado. RepoDigests NÃO constitui comprovação independente da procedência. A inspeção operacional, se realizada, exige evidências diretas e autorização específica.

## HOLD

R92 e testes pagos Luna/Terra anteriormente relatados não foram repetidos. R95–R239 não presumidos instalados na VPS. Ainda faltam evidências HTTP 401/403, Nginx efetivo, conciliação externa de gastos, revisão AppSec/LGPD/FinOps/editorial e integração privada segura Portal/Sites. Sem dados reais, credenciais, deploy/merge, DNS/VPS, CRM/Portal/Sites operacionais, leads, tickets ou cobranças. Preservar main, mascote/site públicos, publicFaiscaEnabled=false. **NO-GO público.**
