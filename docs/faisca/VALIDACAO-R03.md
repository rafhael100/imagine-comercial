# Faísca R03 — evidências de implementação e validação

Referência: 17/11/2026, America/Sao_Paulo. Base: [R02 #452](https://github.com/rafhael100/imagine-comercial/pull/452), SHA `c833c12ff34aaeba56549ae5dc41763a6a909b2a`. Branch de trabalho: `feat/faisca-r03-conversation-contract-2026-11-17`.

## Escopo entregue

Contrato fechado de conversa, runtime simulado com deduplicação e conciliação, cinco cenários de provedor e integração assíncrona no laboratório Astro. A continuidade foi aprovada pelo titular após a publicação da R02. Código e documentos seguem em branch própria e PR draft.

A imagem permanece exatamente a aprovada. A demonstração standalone continua guiada; o laboratório exercita um provedor determinístico local. Não há conexão a LLM, Portal, CRM ou atendimento autenticado, nem alteração de operação na VPS.

## Execuções locais desta entrega

| Verificação | Resultado observado |
|---|---|
| Dependências fixadas | `npm ci --no-audit --no-fund` concluído |
| Suíte completa Comercial | **1.132/1.132**, zero falhas, cancelamentos ou skips |
| Testes Faísca incluídos | **60**: 29 anteriores, 26 de contrato/runtime e 5 de troca de cenário |
| Build Astro isolado | Concluído; uma página fora da árvore pública |
| Navegador standalone | **22/22** cenários aprovados |
| Navegador Astro R03 | **15/15** cenários aprovados |
| Acessibilidade axe | Aprovada em 320, 390 e 1440 px nos dois QA |
| Requisições inesperadas, erros e persistência | Nenhum observado nos cenários executados |
| Build público | 64 arquivos de página gerados; 63 rotas editoriais + 404 |
| Verificador público | HTML, sitemap, robots e limites existentes aprovados |
| Comparação público antes/depois | **85/85 arquivos idênticos**, zero diferenças |

A suíte completa foi executada novamente após a validação do argumento de cancelamento. O laboratório também foi recompilado e os 15 cenários de navegador repetidos após essa correção. O standalone não importa o runtime; seus 22 cenários foram executados sobre o código final da UI.

Os relatórios `ops/faisca/reports/astro-report.json` e `report.json` são gerados pelo QA, ficam fora das fontes versionadas e são coletados pelo workflow já existente. O relatório standalone herdado usa os rótulos `browser: STARTED` e `axe: ATTEMPTED`; seus 22 resultados individuais, incluindo os três testes axe, estão explicitamente aprovados. O relatório Astro registra `browser: EXECUTED` e `axe: EXECUTED`.

Os logs locais completos não são publicados como fontes do produto. O CI desta PR deve vincular a repetição das verificações à SHA efetivamente recebida pelo GitHub; consultar seu resultado antes de declarar aprovação remota.

## Casos de risco exercitados

- Campos extras de autoridade, schema inválido, fontes/versões desconhecidas, ações fora da lista, accessors e proxies revogados são recusados.
- Texto HTML ou comercial inventado é rejeitado mesmo com estrutura e fontes válidas; no simulador, a resposta precisa corresponder ao candidato editorial completo.
- Chamadas concorrentes idênticas compartilham o envio. Mesmo ID com conteúdo diferente retorna conflito. A capacidade esgotada não expulsa registros para permitir replay como novo envio.
- Cancelamento antes do envio produz zero chamadas. Cancelamento e timeout depois do envio conservam resultado incerto; a conciliação usa a resposta tardia sem novo envio.
- Um replay com sinal cancelado não transforma operação enviada em cancelamento anterior ao envio.
- Sinais de cancelamento falsos ou adulterados são recusados antes de criar registro ou avançar a sessão; uma chamada válida posterior pode usar a mesma identificação.
- Reinício, troca de cenário, desmontagem e imports atrasados preservam o isolamento. O próximo rascunho não é apagado pela resposta anterior.
- Teclado, foco, Escape, minimização, movimento reduzido, múltiplas instâncias e fallback sem JavaScript mantêm regressões aprovadas.

## Revisão independente

Uma revisão separada leu os adaptadores de UI/laboratório, contrato e runtime e executou ensaios Node de cenários, reset antes/depois do envio, resposta tardia, proxies revogados e replay cancelado. Não encontrou bloqueador para o escopo simulado.

A revisão identificou que um argumento interno `signal` malformado poderia causar uma exceção depois de reservar a entrada. A implementação foi corrigida para validar o tipo antes de qualquer reserva, e o teste de regressão passou. O adaptador do laboratório já usava um `AbortController.signal` real.

Essa revisão não constitui auditoria de um endpoint ou provedor operacional. A validação de DOM, foco, layout e acessibilidade provém dos QA de navegador descritos acima.

## Integridade visual e isolamento

- PNG: `ops/faisca/assets/faisca-master.png`.
- SHA-256: `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`.
- O template do mascote e `styles.css` permanecem iguais à base.
- O seletor de cenários existe somente na barra de laboratório.
- `src/pages`, `public`, `BaseLayout.astro`, catálogo público, pins e workflows permanecem preservados.

## Continuidade

O contrato e o comportamento simulado estão implementados e testados. O próximo incremento é a fronteira de servidor/transporte em laboratório, descrita em `CODEX-PROXIMA-ENTREGA.md`, com reuso do Imagine Agents.

Identidade real, quotas persistentes, fontes oficiais, observabilidade operacional, provedor externo e integrações de negócio continuam dependências dessa etapa seguinte. A idempotência local não é proteção financeira ou distribuída. Nenhum resultado de CI libera automaticamente merge ou deploy.
