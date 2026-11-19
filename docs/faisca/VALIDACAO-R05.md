# Faísca R05 — execução entre processos e evidências

18/11/2026, America/Sao_Paulo. Candidata de laboratório, em PR de rascunho empilhada sobre [R04 #456](https://github.com/rafhael100/imagine-comercial/pull/456), SHA `5cc938e72f3ec1df7f61dbd68be97d68bc79f569`.

## Entrega verificável

A ponte executa um processo PHP real do Imagine AI Agents por despacho. O PHP usa os componentes originais de conhecimento e coordenação, com provider sintético, e devolve recibo de execução correlacionado. O Node valida o recibo e a integridade do checkout antes de liberar o candidato editorial do Comercial. A sugestão PHP não é texto gerado por um LLM.

Dependência: [Agents R05 #478](https://github.com/rafhael100/imagine-ai-agents/pull/478), SHA **`59d0bae5340c23b37ea1e693e3a1f3915de3c075`**, filha da P67 #476. A mesma SHA aparece no workflow e em `ops/faisca/agents/pin.json`, junto de 19 hashes SHA-256. O pin foi preparado a partir dos bytes efetivamente commitados e conferido localmente sem iniciar processos PHP.

O contrato detalhado está em [`CONTRATO-AGENTS-R05.md`](CONTRATO-AGENTS-R05.md). Os comandos Linux e Windows 11/PowerShell estão em [`ops/faisca/README.md`](../../ops/faisca/README.md).

## Execução local do Comercial

| Verificação executada | Resultado |
|---|---|
| `npm test` | **1.191 testes**, zero falhas e zero skips |
| `node --test tests/faisca-*.test.mjs` | **119 testes**; subconjunto dos 1.191, com 22 novos em relação à R04 |
| Navegador standalone | **22 cenários aprovados** |
| Navegador Astro R03 | **15 cenários aprovados** |
| Navegador HTTP R04 | **15 cenários aprovados** |
| Build separado do laboratório | Duas páginas, `/` e `/http/`, sem rota pública nova |
| Build público e `verify-dist` | Aprovados; **85 arquivos idênticos** à referência pública R02/R03/R04 |
| Preparação do checkout Agents real | Pin validado, zero processos iniciados; não é comprovação de PHP |

Os 52 cenários de navegador anteriores continuam aprovados, incluindo teclado, no-JS, lifecycle, privacidade e axe em 320, 390 e 1440 pixels. As novas unitárias usam fixtures de processo Node explicitamente identificadas para testar framing, adulteração, ambiente, limites, atraso, resultado incerto e descarte. Elas não substituem o PHP real.

O ambiente de edição não possui PHP. Nenhum resultado PHP local é alegado e nenhuma ausência do interpretador é tratada como skip aprovado. A execução nativa em Windows também não ocorreu neste ambiente; os comandos e a seleção de ambiente/caminhos foram preparados, enquanto a evidência automatizada é Linux.

## PHP real e regressão Agents

Execução aprovada: [CI Agents 44235293619](https://github.com/rafhael100/imagine-ai-agents/actions/runs/44235293619), na SHA exata `59d0bae5340c23b37ea1e693e3a1f3915de3c075`, usando PHP 8.3.6.

| Prova executada no Agents | Resultado |
|---|---|
| Ponte Faísca PHP | **256 verificações**, incluindo **29 processos CLI reais** |
| Casos PHP legados | **879 casos**, zero falhas |
| Inventário/lint | **131 arquivos PHP** |
| Scanner de isolamento original | **79 fontes examinadas**, zero violações |
| Motor determinístico original P49 | **2.530 verificações**, incluindo 2.500 casos de fuzz |
| CLI offline original P50 | **19 verificações** com subprocessos reais |
| Gate offline completo R01 | Aprovado, incluindo Python/DOM e contratos existentes |

O sucesso PHP exige uma sugestão, uma passagem de conhecimento, Run concluído e zero tentativas/efeitos CRM. Revogação do grant ou da fonte, expiração e alteração do contexto entre seleção e entrega impedem a resposta. O worker também exercita saídas truncadas e encerramento após sugestão como falhas reais de processo.

### Correções herdadas reveladas pelo gate completo

A base P67 já tinha dois desvios dos gates antigos. O status ultrapassava 16.000 caracteres; a versão integral foi preservada em novo arquivo histórico e o índice atual foi condensado sem remover as evidências requeridas. O scanner também identificou um `require_once` em `src/Automation/DeterministicRuleEngine.php`. O carregamento da mesma dependência passou aos quatro loaders existentes em `tools/`, antes do engine. Nenhum algoritmo, contrato, permissão ou operação PostgreSQL mudou. Os testes P49/P50 acima comprovam o carregamento e comportamento originais. Os testes, limites e scanner foram preservados.

## CI obrigatória do consumidor Comercial

O workflow `faisca-agents-bridge.yml` faz checkout da SHA exata do Comercial e da SHA fixa do Agents. Exige PHP, dependências reproduzíveis, Chromium, build isolado e duas verificações:

- **10 grupos de interop:** pins incompatíveis, recibo PHP real, replay/conflito, recusa do próprio PHP para versão/digest/fonte, timeout leve e consulta antecipada/tardia, deadline, saída malformada, encerramento após despacho, indisponibilidade, revogação e descarte.
- **8 grupos de navegador:** ativação sob demanda e no-JS, sucesso real com axe, consultas sem redispatch, perda da resposta HTTP já concluída, reset/desmontagem/TTL, recusas PHP, adulteração do contexto/versão HTTP e tráfego limitado ao laboratório.

Os grupos contêm múltiplas contraprovas e não devem ser somados aos testes unitários como se fossem a mesma métrica. Os relatórios `Faisca_AGENTS_R05_INTEROP_QA.json` e `Faisca_AGENTS_R05_BROWSER_QA.json` só registram `executedPHP=true` após observar início, conclusão e recibo de sucesso aceito do PHP real. Falta de PHP, checkout incorreto ou qualquer falha encerra a execução com erro. O artefato da CI guarda apenas resultados sintéticos.

Os checks e o corpo da PR Comercial são a referência para o resultado dessa execução e sua SHA. O workflow específico complementa os três checks anteriores: validação geral, Faísca guiado e laboratório PostgreSQL efêmero já existente. Nenhum banco local ou persistente é usado para comprovar esta ponte.

## Preservação

Comparação direta de bytes com a R04 confirmou que permanecem iguais: PNG aprovado, `demo.template.html`, `styles.css`, `ui.mjs`, `core.mjs`, `knowledge.mjs`, `lab/http-ui.mjs` e `lab/http-client.mjs`.

SHA-256 do PNG: `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`, 1.887.660 bytes. Digest do conhecimento: `fe7daf5ab310acc5a0a600803254344ed02eff7bbd860b731cdf033dcbe4ead7`.

O runtime recebeu somente o tratamento de `provider_unknown`, com regressão específica. A apresentação HTTP removeu “R04” do título para ser compartilhada pelos dois entrypoints. A imagem não foi regenerada ou alterada; animação continua sendo movimento CSS do quadro inteiro.

## Limites materiais

O PHP recebe metadados e referências; a passagem de conhecimento é uma fixture agregada, não o documento comercial completo. Respostas continuam editoriais e o provider permanece determinístico. Não há chamada a LLM, voz, identidade de cliente ou efeito comercial.

Sessões e registros continuam voláteis. Consulta recupera somente resultado existente na mesma instância; não recompõe um recibo perdido após encerramento do worker ou reinício do servidor. O PHP sem resultado confiável mantém a operação incerta, sem retry automático. Reset/expiração encerra a sessão e invalida callbacks antigos.

A publicação é de código e documentação para revisão em branches isoladas. Site público, deploy, VPS/DNS e produção permanecem fora desta entrega. O próximo recorte está descrito em [`CODEX-PROXIMA-ENTREGA.md`](CODEX-PROXIMA-ENTREGA.md).
