# Faísca R255 — revisão pareada com política Docker completa

**REVIEW ONLY / NO-GO público.** Esta entrega fecha a lacuna entre a checagem
básica de container da R253 e os controles completos da R236–R238. Um registro
Docker com tmpfs ilimitado, mount gravável, privilégio extra, namespace de host
ou rede insegura era insuficientemente avaliado na R253 isolada. A R255 exige
que o registro passe pela política completa **antes** de qualquer HTTP.

## Escopo da verificação

1. Um contêiner em execução com serviço Compose esperado, imagem digest-pinned,
   identidade 101:101 e somente a porta local 127.0.0.1:4337.
2. Root filesystem somente leitura, três mounts bind somente leitura para
   site, Nginx e htpasswd, tmpfs /tmp (32 MiB) e /var/run (4 MiB) com
   noexec/nosuid, sem capacidades adicionais, dispositivos, namespaces do host,
   mudanças de DNS, com limites de CPU/memória/PIDs e política sem restart.
3. Somente após isso, reutiliza a R253 para comparar identidade local de
   imagem e pin independente, e exige **19 respostas HTTP 401 protegidas**
   pelo auditor GET/HEAD da R252. Qualquer desvio gera apenas HOLD.

Os testes Node simulam o Docker inspect e a composição do resultado HTTP,
validando inclusive que um contêiner inseguro não provoca requisição.
A R253 mantém testes independentes de HTTP real contra servidor sintético.
Esta entrega não solicita chaves, não chama a OpenAI e não altera serviços.

## Procedimento exclusivamente privado

Operador autorizado: usar checkout limpo com SHA conhecida por canal externo,
Node >=22.12 e os dois registros Docker obtidos de acesso operacional já
autorizado. **Não enviar inspect JSON ao GitHub, logs, artifacts ou ao chat.**

O CLI lê somente stdin (máximo 512 KiB), com exatamente duas propriedades:
container = array de um Docker inspect e image = array de um image inspect.
Recusa CI, argumentos, hosts externos e qualquer porta diferente de 4337.

Prover fora do repositório, com origem independente dos registros inspecionados:

- IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW=1
- IMAGINE_FAISCA_NGINX_IMAGE — referência digest revisada externamente
- IMAGINE_FAISCA_STAGING_WORKDIR — caminho absoluto do checkout revisado
- IMAGINE_FAISCA_STAGING_SITE_DIR — caminho absoluto do conteúdo privado
- IMAGINE_FAISCA_STAGING_HTPASSWD_PATH — caminho absoluto do bcrypt privado

Execução conceitual, **apenas após autorização operacional própria**:

    node scripts/faisca-review-full-runtime-staging.mjs < /caminho-privado/inspect-pair.json

Se algum campo falhar, não é emitido relatório positivo parcial ou texto
sensível. O relatório de sucesso contém somente indicadores sem identificadores
e permanece REVIEW ONLY.

## Limites que continuam em HOLD

Amostras Docker fornecidas pelo operador podem ser antigas ou fabricadas.
O teste não acessa Docker, não comprova que o contêiner declarado serviu a porta
local, não mede exposição pública independente, não autentica a conversa R95,
não comprova a instalação R95+ na VPS, não reconcilia fatura OpenAI e **não**
concede GO. O pacote completo exige observação operacional e proveniência
independente, conversa fictícia autenticada, gastos conciliados e revisão
AppSec/LGPD/FinOps/editorial.

Não realizar merge/deploy, DNS/VPS, ativação pública ou ações CRM/Portal/Sites.
Preservar mascote, site público, main e publicFaiscaEnabled=false.
