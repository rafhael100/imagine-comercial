# Faísca — orientação com trechos comerciais R06

Continuação da [atividade #444](https://github.com/rafhael100/imagine-comercial/issues/444), [R02 #452](https://github.com/rafhael100/imagine-comercial/pull/452), [R03 #453](https://github.com/rafhael100/imagine-comercial/pull/453) e [R04 #456](https://github.com/rafhael100/imagine-comercial/pull/456). O PNG aprovado e as três jornadas — escolha de solução, dúvidas e orientação de pós-venda — foram preservados.

A R06 acrescenta **21 trechos comerciais literais, organizados em 11 respostas**, com citação visível em “Base desta orientação”. O PHP recupera os trechos pinados e recompõe a resposta inteira; Node e navegador verificam o vínculo com o turno preparado. Perguntas sem fonte ou com objetivos diferentes recebem uma limitação explícita, sem inventar uma escolha comercial.

Continuação da [R05 Comercial #457](https://github.com/rafhael100/imagine-comercial/pull/457). O contrato detalhado está em [`CONTRATO-CONHECIMENTO-R06.md`](../../docs/faisca/CONTRATO-CONHECIMENTO-R06.md) e as evidências em [`VALIDACAO-R06.md`](../../docs/faisca/VALIDACAO-R06.md). O catálogo é um snapshot editorial de revisão; preços, condições e atendimento privado continuam sujeitos aos canais oficiais.

## Experimentar a R06

Requisitos: Node >=22.12, Git e PHP >=8.2 CLI já disponíveis. Use checkouts dedicados, com bytes preservados. `grounding/pin.json` fixa a SHA Agents e os hashes dos 23 arquivos revisados. Os três arquivos comerciais de origem, o catálogo e o conhecimento R02 também são conferidos antes da execução e da entrega.

No Linux, na raiz deste checkout Comercial:

```sh
npm ci --no-audit --no-fund
git -c core.autocrlf=false clone https://github.com/rafhael100/imagine-ai-agents.git ../imagine-ai-agents-faisca-r06
faisca_r06_sha=$(node -p "JSON.parse(require('node:fs').readFileSync('ops/faisca/grounding/pin.json','utf8')).commit")
git -C ../imagine-ai-agents-faisca-r06 checkout --detach "$faisca_r06_sha"
export IMAGINE_FAISCA_AGENTS_ROOT="$(cd ../imagine-ai-agents-faisca-r06 && pwd)"
export IMAGINE_FAISCA_LAB=1
npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
export IMAGINE_FAISCA_HTTP_LAB=1
export IMAGINE_FAISCA_AGENTS_LAB=1
export IMAGINE_FAISCA_GROUNDED_LAB=1
node ops/faisca/grounding/serve.mjs
```

No Windows 11 / PowerShell, com Node, Git e PHP CLI instalados:

```powershell
npm ci --no-audit --no-fund
git -c core.autocrlf=false clone https://github.com/rafhael100/imagine-ai-agents.git ../imagine-ai-agents-faisca-r06
$faiscaR06Sha = (Get-Content ops/faisca/grounding/pin.json -Raw | ConvertFrom-Json).commit
git -C ../imagine-ai-agents-faisca-r06 checkout --detach $faiscaR06Sha
$env:IMAGINE_FAISCA_AGENTS_ROOT = (Resolve-Path ../imagine-ai-agents-faisca-r06).Path
$env:IMAGINE_FAISCA_PHP_BINARY = (Get-Command php.exe).Source
$env:IMAGINE_FAISCA_LAB = "1"
npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
$env:IMAGINE_FAISCA_HTTP_LAB = "1"
$env:IMAGINE_FAISCA_AGENTS_LAB = "1"
$env:IMAGINE_FAISCA_GROUNDED_LAB = "1"
node ops/faisca/grounding/serve.mjs
```

Abra **http://127.0.0.1:4332/grounded/** no Edge ou Chrome e ative a conversa. Use mensagens fictícias como “Qual a diferença entre Onepage e Landing Page?”, “O site inclui e-mail?” ou “Quero apresentar minha empresa e captar contatos para uma campanha.” A primeira mostra trechos; a segunda indica ausência de fonte; a terceira pede que você escolha um objetivo. Encerre com Ctrl+C.

A ativação sozinha não abre sessão nem executa PHP. Navegação, ausência de fonte, ambiguidade e limites de atendimento seguem como orientação local, sem citação nem despacho PHP. Mensagens sensíveis continuam bloqueadas antes da rede. O resumo é preparado para cópia; ele não é enviado à equipe.

`IMAGINE_FAISCA_HTTP_PORT` altera a porta local. `IMAGINE_FAISCA_AGENTS_SCENARIO` aceita os cenários R05 abaixo e, na R06, `source_disabled_before_delivery`. As opções são do host confiável, nunca da mensagem do visitante. Em `delay`, consulte a resposta pendente: a consulta recupera o despacho original sem iniciar outro PHP. Falta de resultado confiável após despacho permanece incerta.

O checkout Comercial também deve preservar fins de linha dos arquivos pinados. A evidência automatizada é Linux; execução nativa em Windows não foi realizada neste ambiente. A porta deve permanecer exclusivamente local.

## Ponte R05 preservada

A R05 acrescenta **execução real entre Node e um processo PHP do Imagine AI Agents**, no laboratório local. O PHP usa os componentes existentes de conhecimento e coordenação com provedor sintético. A resposta visível continua sendo o texto editorial aprovado do Comercial; o PHP recebe apenas hashes, identificadores opacos e referências permitidas. A página HTTP fica exclusivamente no laboratório, fora do site público.

## Experimentar a R05

Requisitos: Node >=22.12, Git e PHP >=8.2 CLI já disponíveis. Os dois repositórios precisam estar nos commits revisados. O pin em `agents/pin.json` fixa a SHA do Agents e os hashes dos 19 arquivos executados. Alterações nesses arquivos ou na base editorial fazem a ponte recusar a inicialização ou entrega.

Use um checkout Agents dedicado à revisão; `checkout --detach` abaixo não deve ser executado sobre trabalho local não salvo. Desative conversão de fins de linha no clone para preservar os bytes pinados. Na raiz deste checkout Comercial, no Linux:

```sh
npm ci --no-audit --no-fund
git -c core.autocrlf=false clone https://github.com/rafhael100/imagine-ai-agents.git ../imagine-ai-agents-faisca-r05
agents_sha=$(node -p "JSON.parse(require('node:fs').readFileSync('ops/faisca/agents/pin.json','utf8')).commit")
git -C ../imagine-ai-agents-faisca-r05 checkout --detach "$agents_sha"
export IMAGINE_FAISCA_AGENTS_ROOT="$(cd ../imagine-ai-agents-faisca-r05 && pwd)"
export IMAGINE_FAISCA_LAB=1
npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
export IMAGINE_FAISCA_HTTP_LAB=1
export IMAGINE_FAISCA_AGENTS_LAB=1
node ops/faisca/agents/serve.mjs
```

Abra **http://127.0.0.1:4331/http/** no Edge ou Chrome. Ative a conversa e use apenas mensagens fictícias. A ativação sozinha não cria sessão nem inicia PHP. Encerre com Ctrl+C.

No Windows 11 / PowerShell, com Node, Git e PHP CLI instalados:

```powershell
npm ci --no-audit --no-fund
git -c core.autocrlf=false clone https://github.com/rafhael100/imagine-ai-agents.git ../imagine-ai-agents-faisca-r05
$agentsSha = (Get-Content ops/faisca/agents/pin.json -Raw | ConvertFrom-Json).commit
git -C ../imagine-ai-agents-faisca-r05 checkout --detach $agentsSha
$env:IMAGINE_FAISCA_AGENTS_ROOT = (Resolve-Path ../imagine-ai-agents-faisca-r05).Path
$env:IMAGINE_FAISCA_PHP_BINARY = (Get-Command php.exe).Source
$env:IMAGINE_FAISCA_LAB = "1"
npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
$env:IMAGINE_FAISCA_HTTP_LAB = "1"
$env:IMAGINE_FAISCA_AGENTS_LAB = "1"
node ops/faisca/agents/serve.mjs
```

O checkout Comercial também precisa preservar os bytes de `knowledge.mjs`; a ponte recusa uma cópia convertida para CRLF. As evidências de execução registradas nesta entrega são do runner Linux; execução nativa em Windows deve ser conferida no ambiente de uso.

`IMAGINE_FAISCA_HTTP_PORT` altera a porta local. `IMAGINE_FAISCA_AGENTS_SCENARIO` aceita `success`, `delay`, `unavailable`, `malformed`, `exit_after_dispatch` ou `revoke_before_delivery`. São opções do processo confiável, sem controle pelo navegador. O cenário `delay` da CLI usa 800 ms; o timeout de apresentação é 250 ms e o prazo do processo é 3 s.

Em um atraso, use **Consultar resposta pendente**. A consulta busca o resultado do despacho original sem iniciar outro PHP. Saída truncada, encerramento inesperado ou prazo esgotado após o início do PHP permanecem incertos; quando o processo já encerrou sem recibo válido, consultas não podem recuperar um resultado inexistente. Reiniciar encerra essa sessão de laboratório e permite começar outra.

## Experimentar a R04 preservada

Na raiz do checkout, com Node >=22.12:

```sh
npm ci --no-audit --no-fund
npm test
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
IMAGINE_FAISCA_HTTP_LAB=1 node ops/faisca/server/serve.mjs
```

Abra **http://127.0.0.1:4330/http/** no Edge ou Chrome. Ative a conversa e use apenas mensagens fictícias. A primeira mensagem permitida cria a sessão; a ativação sozinha não chama a API.

No PowerShell:

```powershell
npm ci --no-audit --no-fund
npm test
$env:IMAGINE_FAISCA_LAB = "1"
npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
$env:IMAGINE_FAISCA_HTTP_LAB = "1"
node ops/faisca/server/serve.mjs
```

`IMAGINE_FAISCA_HTTP_PORT` altera a porta local. `IMAGINE_FAISCA_HTTP_SCENARIO` aceita `success`, `unavailable`, `limit`, `timeout` ou `malformed`. São configurações confiáveis do processo; mensagens e controles do navegador não escolhem provedor, endpoint ou contexto. Para testar atraso:

```sh
IMAGINE_FAISCA_HTTP_LAB=1 IMAGINE_FAISCA_HTTP_SCENARIO=timeout node ops/faisca/server/serve.mjs
```

Em `timeout`, o turno continua pendente e aparece **Consultar resposta pendente**. A consulta usa a mesma identificação e não reenvia a mensagem ao provedor. Quando chega uma resposta final validada, a conversa e o resumo avançam uma vez. Reiniciar descarta a exibição antiga e tenta excluir a sessão no servidor; isso não prova cancelamento de uma mensagem já recebida.

Encerre com Ctrl+C. Não exponha a porta por proxy, túnel ou interface externa. O servidor fixa o bind em `127.0.0.1`, exige Host/Origin exatos e não habilita CORS. Esse perfil serve apenas ao ensaio local.

## Modos anteriores preservados

| Modo | Como abrir | Transporte da conversa |
|---|---|---|
| Standalone guiado | `node ops/faisca/build-demo.mjs`; abrir `ops/faisca/output/Faisca_Demonstracao.html` | Nenhuma conexão; CSP `connect-src 'none'` |
| Contrato R03 no browser | `http://127.0.0.1:4330/` no servidor acima, ou Astro dev na porta 4329 | Simulador na memória da página |
| HTTP R04 | `http://127.0.0.1:4330/http/` | Browser → servidor loopback → simulador |
| PHP Agents R05 | `http://127.0.0.1:4331/http/`, com `agents/serve.mjs` | Browser → servidor loopback → PHP Agents pinado |
| Trechos comerciais R06 | `http://127.0.0.1:4332/grounded/`, com `grounding/serve.mjs` | Browser → servidor loopback → PHP com resposta vinculada ao catálogo |

O desenvolvimento estático R03 continua com `IMAGINE_FAISCA_LAB=1 npx --no-install astro dev --config ops/faisca/lab/astro.config.mjs`. O Astro dev sozinho não implementa a API R04.

## Responsabilidades

| Caminho | Responsabilidade |
|---|---|
| `assets/faisca-master.png`, `asset-manifest.json` | Mascote aprovado e integridade |
| `knowledge.mjs`, `core.mjs` | Base editorial, jornadas, pré-verificação e ações curadas |
| `conversation-contract.mjs`, `conversation-runtime.mjs` | Contrato, correlação, deduplicação e conciliação R03 reutilizados |
| `http-contract.mjs` | Sessão, contexto e resultado HTTP com schemas fechados |
| `server/http-lab.mjs`, `server/serve.mjs` | Servidor loopback, sessões, limites e CLI explícita |
| `agents/protocol.mjs`, `agents/pin.json` | Contrato privado entre processos e dependências revisadas |
| `agents/php-provider.mjs`, `agents/serve.mjs` | Verificação de pin, processo PHP limitado e ativação explícita R05 |
| `lab/http-client.mjs` | Token em memória, pré-verificação antes da rede, transporte e resultado incerto |
| `lab/http-ui.mjs`, `lab/http-host.mjs` | Ativação sob demanda, consulta manual e ciclo de vida |
| `lab/src/components/FaiscaHttpLab.astro` | Página isolada com os controles HTTP |
| `ui.mjs` | UI compartilhada com política de turno injetada pelo host; resumo avança após resultado aceito |
| `browser-qa.mjs`, `lab/browser-qa.mjs`, `server/browser-qa.mjs` | Regressões e acessibilidade nos três modos |
| `agents/check-interop.mjs`, `agents/browser-qa.mjs` | Interop e navegador R05 exigindo PHP real |
| `grounding/catalog.json`, `catalog.mjs`, `guide.mjs` | Trechos literais, receitas e seleção conservadora R06 |
| `grounding/protocol.mjs`, `php-provider.mjs`, `pin.json` | Vínculo integral da resposta e processo PHP R06 pinado |
| `grounding/http-policy.mjs`, `grounded-ui.mjs` | Mesma política de turno e verificação exata do resultado no navegador |
| `grounding/check-interop.mjs`, `browser-qa.mjs` | Provas R06 com PHP real, sem substituição ou skip |
| `scripts/verify-faisca-grounding.mjs` | Origem, seletor, literalidade, hashes e catálogo compilado |

## Verificação

```sh
node --test tests/faisca-*.test.mjs
node scripts/verify-faisca-grounding.mjs
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/browser-qa.mjs
node ops/faisca/lab/browser-qa.mjs
node ops/faisca/server/browser-qa.mjs
node ops/faisca/agents/check-interop.mjs
node ops/faisca/agents/browser-qa.mjs
npm run build
node scripts/verify-dist.mjs
```

Os três HTML são `/index.html`, `/http/index.html` e `/grounded/index.html`, em `ops/faisca/output/astro`. Os QA usam conteúdo sintético e portas efêmeras; não é necessário deixar a CLI aberta. `FAISCA_CHROMIUM_EXECUTABLE` pode indicar um Chromium autorizado. O workflow Faísca coleta os relatórios sintéticos de `ops/faisca/reports/`.

Os dois scripts `agents/` exigem `IMAGINE_FAISCA_AGENTS_ROOT`, o checkout pinado e PHP real; ausência dessas condições é falha. Os testes unitários de ciclo de vida Node usam fixtures explicitamente identificadas e não comprovam execução PHP. O workflow R05 faz o checkout da SHA Agents fixa e exige os testes entre processos e no navegador.

Com `IMAGINE_FAISCA_AGENTS_ROOT` apontando ao checkout R06 pinado, execute também `node ops/faisca/grounding/check-interop.mjs` e `node ops/faisca/grounding/browser-qa.mjs`. Os checks R05 precisam do checkout R05 próprio, pois seu pin permanece inalterado. Cada workflow faz os checkouts corretos.

O site público mantém `publicFaiscaEnabled=false` e não importa o laboratório. Consulte [`VALIDACAO-R05.md`](../../docs/faisca/VALIDACAO-R05.md), [`CONTRATO-AGENTS-R05.md`](../../docs/faisca/CONTRATO-AGENTS-R05.md), [`CONTRATO-HTTP-R04.md`](../../docs/faisca/CONTRATO-HTTP-R04.md) e [`CODEX-PROXIMA-ENTREGA.md`](../../docs/faisca/CODEX-PROXIMA-ENTREGA.md).

## Limites desta entrega

A sessão é pública e sintética: não autentica clientes, empresas, contratos ou acesso de pós-venda. A integração PHP executa `MockKnowledgeRetriever`, `MockContextEnvelope`, `SupervisedCoordinator` e `MockAiSuggestionProvider`, com gateway que recusa efeitos. Na R05, a passagem PHP é um digest das referências admitidas. Na R06, a camada própria recupera os trechos comerciais literais, enquanto o recibo de execução legado continua sintético. O catálogo R06 tem seleção finita e não cobre toda pergunta livre. Portal, Central, CRM, voz e LLM permanecem fora dessa ponte.

Os registros ficam na memória do processo, por até cinco minutos na configuração padrão, e desaparecem no encerramento. Não há persistência distribuída, reserva de crédito ou garantia financeira de execução única. Recarregar a página perde o token; uma resposta de criação perdida pode deixar uma sessão órfã até expirar.

A verificação local de padrões sensíveis é auxiliar e não identifica todo dado pessoal. Use apenas conteúdo fictício. Tokens não vão para URLs, cookies, DOM, logs ou storage; a API recebe o texto permitido no corpo HTTP local. O resumo copiado não é envio à equipe.

O PNG, recorte, cores e estilos permanecem preservados. A animação continua sendo movimento CSS do quadro inteiro; não há modelo 3D articulado. Publicar código em PR draft não ativa o site nem autoriza merge, deploy, despesas ou mudanças na VPS/DNS.
