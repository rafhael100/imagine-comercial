# Faísca R06 — evidências de conhecimento comercial verificável

18/11/2026, America/Sao_Paulo. Continuação de laboratório sobre [Comercial R05 #457](https://github.com/rafhael100/imagine-comercial/pull/457), SHA `84b4c82d1a7ff77b4ee7212bc877d4639ceb809d`.

## Resultado implementado

O Faísca compõe respostas com **21 trechos literais, organizados em 11 receitas**, extraídos de três arquivos comerciais. O PHP recupera os trechos normativos, recompõe integralmente a resposta e confere o vínculo. Node e navegador recusam texto, citação ou ação incompatível com o turno preparado, incluindo uma passagem legítima de outro assunto.

O usuário pode expandir **Base desta orientação** para ler fonte, snapshot e trecho. Informações ausentes e perguntas com objetivos diferentes recebem limites explícitos; não inventam uma escolha nem despacham PHP. Navegação e atendimento privado permanecem orientações locais, sem atribuição indevida de fonte.

O [contrato R06](CONTRATO-CONHECIMENTO-R06.md) descreve formato, limites, procedência, validade e a fronteira de um futuro modelo. O [README](../../ops/faisca/README.md) contém reprodução Linux e Windows 11/PowerShell, na rota local `http://127.0.0.1:4332/grounded/`.

## Dependência executada

[Agents R06 #484](https://github.com/rafhael100/imagine-ai-agents/pull/484), SHA **`36caf2ee3585c3f64a6f1d78552550ae5aaebeb0`**, filha da R05 `59d0bae5340c23b37ea1e693e3a1f3915de3c075`. A mesma SHA está no workflow Comercial R06 e em `ops/faisca/grounding/pin.json`, com 23 hashes calculados dos bytes commitados e comparados ao checkout local.

Catálogo: `faisca-grounding-1`, digest **`205754a9b45e723560276e0f7145b05b1a1d3eb6d87c5dd9e006ce84b9aceed8`**. A cópia PHP é idêntica byte a byte à cópia Comercial. O catálogo deriva do snapshot R05, sem depender de conteúdo externo consultado em tempo de resposta.

## Verificação local do Comercial

| Verificação executada | Resultado |
|---|---|
| `npm test` | **1.211 testes**, zero falhas e zero skips; 20 novos em relação à R05 |
| Catálogo e seleção | **13 testes**, incluindo dataset de 13 perguntas e mutações de origem/receita/fatos |
| Política HTTP R06 | **4 testes**, incluindo fonte legítima de outro assunto e recuperação do turno original |
| Protocolo/processo R06 | **3 testes**, com digests independentes, metadados mínimos e adulteração antes/depois do processo |
| Suítes conjuntas R05/R06 | **41 testes**, incluindo os 21 originais de protocolo/processo R05 |
| Verificador do catálogo | 3 arquivos, 21 seletores/trechos literais e 11 respostas conferidos |
| Navegador standalone | **22/22 cenários** |
| Navegador Astro R03 | **15/15 cenários** |
| Navegador HTTP R04 | **15/15 cenários** |
| Build do laboratório | Três páginas: `/`, `/http/` e `/grounded/` |
| Build público e `verify-dist` | Aprovados; **85 arquivos idênticos** ao build público R05 |
| Actions imutáveis | 2 verificações aprovadas após adicionar o workflow R06 |
| Preparação do pin Agents publicado | Aprovada com zero processos iniciados; não contada como execução PHP |

As contagens de subsets não devem ser somadas aos 1.211 testes. As fixtures Node de processo estão identificadas como provas do transporte; não comprovam PHP. As suítes de navegador antigas mantêm seus requisitos de teclado, no-JS, lifecycle, tráfego local e axe em 320, 390 e 1440 pixels.

O novo diretório `grounded` foi incluído tanto na lista de diretórios quanto na lista de arquivos HTML permitidos pelo servidor. A primeira execução HTTP revelou que aceitar apenas o arquivo era insuficiente; a correção preservou a allowlist fechada e os 52 cenários antigos passaram.

## PHP real e regressões Agents

[CI Agents 44295966402](https://github.com/rafhael100/imagine-ai-agents/actions/runs/44295966402), na SHA exata acima, usando **PHP 8.3.6**:

| Verificação executada | Resultado |
|---|---|
| Nova recuperação R06 | **333 verificações**, incluindo **36 processos CLI reais**, todas as 11 receitas e 21 passagens |
| Ponte R05 preservada | **256 verificações**, incluindo **29 processos CLI reais** |
| Casos PHP legados | **879 casos**, zero falhas |
| Inventário/lint | **133 arquivos PHP** |
| Scanner de isolamento original | **81 fontes**, zero violações |
| P49 determinístico original | **2.530 verificações**, incluindo 2.500 casos de fuzz |
| P50 CLI original | **19 verificações** |
| Gate R01 completo | Aprovado, incluindo contratos Python/DOM e histórico documental |

As provas R06 incluem reconstrução independente do candidato, troca por passagem legítima de outro assunto, prosa arbitrária com hash recalculado, ordem/versão/digest, callbacks, expiração, relógio, revogação e fonte desabilitada. A sugestão original permanece sintética e o gateway não executa efeitos CRM.

A primeira CI, [44295599721](https://github.com/rafhael100/imagine-ai-agents/actions/runs/44295599721), falhou no oráculo de um teste: ele esperava o `factValue` sintético em lugar do campo `text` legado. O ajuste passou a comparar exatamente `SYNTHETIC_FAISCA_CONTEXT_<digest>`, que é o texto efetivamente recebido pelo provider. A comparação integral, chamada única, hash e guards foram mantidos; nenhum código R05 foi alterado para fazer o teste passar. A execução aprovada é a da SHA final, não a primeira tentativa.

O ambiente local de edição não possui PHP; nenhuma execução local do interpretador é alegada. A evidência PHP veio do runner Linux. Execução nativa em Windows ainda deve ser conferida no ambiente de uso.

## CI obrigatória do consumidor Comercial

O workflow `faisca-grounded-knowledge.yml` faz checkout da SHA exata da PR Comercial e da SHA Agents fixada. Exige PHP real, instalação reproduzível, Chromium, build do laboratório e verificador de origem.

**Sete grupos de interoperabilidade R06** exercitam pins, fontes e catálogo adulterados; todas as receitas via PHP; vínculo errado apesar de passagem válida; candidato falso; revogação/fonte desabilitada; atraso e consulta; e perda de resultado sem redispatch. A suite exige 20 invocações CLI diretas e sete despachos pelo runtime.

**Oito grupos de navegador R06** verificam ativação sob demanda, no-JS e sensíveis; ausência/ambiguidade sem PHP; renderização dos trechos retornados com axe; troca de assunto e prosa adulterada na resposta HTTP; consulta antecipada/tardia; descarte no reset/desmontagem; recusa PHP por revogação/fonte; e tráfego, storage, tokens e erros de execução.

Essas suites só registram `executedPHP=true` depois de observar conclusão real aceita de PHP. Falta de PHP, checkout errado, processo substituto ou teste incompleto não são sucesso. Os relatórios sintéticos são `Faisca_GROUNDING_R06_INTEROP_QA.json` e `Faisca_GROUNDING_R06_BROWSER_QA.json`, arquivados pela CI.

O workflow R05 permanece separado, com seu próprio pin original e suas dez verificações de interop/oito de navegador. A CI guiada anterior, o gate geral e o laboratório PostgreSQL efêmero permanecem ativos. O corpo da PR e os checks da SHA Comercial efetivamente publicada registram os resultados dessas execuções; este documento não antecipa o sucesso de uma CI ainda não executada na sua versão.

## Preservação e limites

Comparação byte a byte com a R05 confirmou a preservação de `assets/faisca-master.png`, `demo.template.html`, `styles.css`, `core.mjs` e `knowledge.mjs`. O PNG aprovado tem 1.887.660 bytes e SHA-256 **`1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`**. O conhecimento R02 conserva digest `fe7daf5ab310acc5a0a600803254344ed02eff7bbd860b731cdf033dcbe4ead7`.

A UI recebeu a escolha confiável da política de turno; cliente HTTP e runtime compartilham a mesma seleção. O processo PHP comum foi extraído internamente, mantendo a API R05 e seus testes. Não se afirma identidade de bytes desses arquivos de integração alterados. O mascote, seu recorte e as cores não foram redesenhados; a animação permanece movimento CSS do quadro inteiro.

O site público permanece com `publicFaiscaEnabled=false`. A publicação é de código e documentos para revisão em branches e PRs draft. As respostas continuam determinísticas, com catálogo finito e editorial; não há LLM externo, acesso a cliente, envio à equipe, CRM operacional ou geração de promessa comercial. Os registros são voláteis e a conciliação não sobrevive à perda da instância. A continuidade está registrada em `CODEX-PROXIMA-ENTREGA.md`.
