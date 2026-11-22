# Faísca R253 — revisão pareada de identidade Docker declarada e HTTP privado local

**REVIEW ONLY / NO-GO público.** Esta entrega não configura a VPS, não acessa Docker,
não instala a R95, não faz deploy, não valida conversas autenticadas e não
reconcilia custos Luna/Terra. Nenhuma chave é necessária.

## O que é verificado

Uma única execução local aceita **exatamente um** registro Docker inspect do
contêiner e **um** Docker image inspect, de fonte privada do operador, e confronta
a imagem referenciada com o **pin SHA-256 fornecido independentemente** pela
operação (R239). Exige contêiner informado como running, serviço
faisca-review, usuário 101:101, rede Compose específica, somente
127.0.0.1 na porta declarada em 8080/tcp, sem outra porta publicada ou privilégio
explícito no registro examinado.

Depois executa, sequencialmente, as **19 sondas GET/HEAD sem credenciais da
R252** no loopback informado: rotas canônicas, aliases e caminhos codificados.
Qualquer divergência retorna **somente HOLD**, sem relatório parcial, cabeçalhos,
corpos, caminhos, identificadores ou pins. O CLI nunca recebe um host externo,
URL, cookies, tokens ou credenciais; não escreve arquivos.

Este cruzamento é **consistência entre dois conjuntos de observações**, não
prova de que o processo Docker informado efetivamente serviu as respostas HTTP.
As duas fontes podem ser copiadas, antigas ou adulteradas. A verificação integral
de mounts, namespaces e isolamento continua na R236–R238; mesmo essas
verificações não substituem evidência autenticada e independente da VPS.

## Uso exclusivamente privado, após autorização operacional própria

Requer Node >=22.12 e um servidor de revisão já disponível em
127.0.0.1:4337. O operador obtém os dois registros por meios autorizados,
revisa localmente os campos sensíveis e os mantém fora de repositório, logs,
artifacts e conversas. O arquivo JSON privado deve ter exatamente as chaves
container e image, cada qual com um array de **um** registro. Limite 512 KiB.
O pin IMAGINE_FAISCA_NGINX_IMAGE precisa vir de canal externo independente
do JSON inspecionado; não inferir o pin a partir de RepoDigests.

Exemplo conceitual, **não executar contra serviço operacional sem autorização**:

    IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW=1 \
    IMAGINE_FAISCA_NGINX_IMAGE='nginxinc/nginx-unprivileged@sha256:<pin-validado-externamente>' \
      node scripts/faisca-review-paired-staging.mjs < /caminho-privado/inspect-pair.json

A opção --port N existe só para teste em servidor *loopback* já isolado;
**4337 é a porta padrão revisada** e relatórios em outras portas indicam
reviewedDefaultStagingPort=false.

## Evidência e limites

Uma aprovação reporta exatamente 19 respostas protegidas, correlação declarada
de binding e identidade local da imagem, mas mantém em false:
dockerInspectionPerformed, dockerToHttpProcessOwnershipIndependentlyVerified,
containerRuntimePolicyFullyVerified, registryProvenanceIndependentlyVerified,
independentNetworkExposureVerified, authenticatedConversationVerified,
providerSpendReconciled, operatorEvidenceAuthenticated, publicReady,
deploymentAuthorized, deploymentPerformed e publicFaiscaEnabled.

A CI exercita somente contêiner, imagem e servidor HTTP **sintéticos**, inclusive
falhas de binding público, identidade divergente, resposta HTTP 200 indevida,
entrada extra, execução de CI, host externo e vazamento de detalhes.

**Próximos gates:** atestar identidade externa da VPS e procedência da imagem,
provar propriedade processo/porta sem confiar só em JSON local, validar a
experiência autenticada com perguntas fictícias e políticas editoriais, conciliar
gastos externamente, revisar AppSec/LGPD/FinOps e obter GO humano distinto.
Preservar main, site público, mascote e publicFaiscaEnabled=false.
