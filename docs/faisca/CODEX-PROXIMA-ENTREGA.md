# Codex — estado R05 e próxima etapa do Faísca

18/11/2026, America/Sao_Paulo. Projeto Faísca, prioridade Imagine Comercial. Atividade: [#444](https://github.com/rafhael100/imagine-comercial/issues/444). Preservar integralmente a imagem aprovada.

## Base já entregue e reutilizada

| Etapa | Entrega |
|---|---|
| [R02 #452](https://github.com/rafhael100/imagine-comercial/pull/452) | PNG aprovado, demo guiada, ciclo de vida, Astro e acessibilidade; SHA `c833c12ff34aaeba56549ae5dc41763a6a909b2a` |
| [R03 #453](https://github.com/rafhael100/imagine-comercial/pull/453) | Contrato fechado, simulador, deduplicação, incerteza e conciliação; SHA `7baf105b3601774b62c3492340e552300caf5e5b` |
| [R04 #456](https://github.com/rafhael100/imagine-comercial/pull/456) | HTTP loopback real, sessão/contexto emitidos pelo servidor, limites, expiração e cliente sem persistência; SHA `5cc938e72f3ec1df7f61dbd68be97d68bc79f569` |
| R05 desta branch | Processo PHP Agents real, pin entre repositórios, recibo sintético validado, revalidação de contexto na entrega e preservação de resultado incerto |

Leia `CONTRATO-AGENTS-R05.md`, `VALIDACAO-R05.md` e `ops/faisca/README.md`. A R05 tem entrada própria `ops/faisca/agents/serve.mjs`, porta padrão 4331, sobre o servidor HTTP R04. A base editorial permanece `faisca-editorial-2`.

## O que a R05 comprova

O Node inicia um PHP de invocação única. O PHP chama as classes originais `MockKnowledgeRetriever`, `MockContextEnvelope`, `SupervisedCoordinator` e `MockAiSuggestionProvider`, com contexto Faísca sintético fixo e gateway que recusa efeitos. O consumidor exige correlação, versão, hashes, sugestão exata e contadores derivados da execução. Fontes/grant são revalidados antes de entregar. A CI específica exige PHP real e navegador real, sem skip ou substituto JavaScript.

O PHP recebe identificadores, hashes e referências curadas; o texto final continua vindo do Comercial. A passagem recuperada no PHP é uma fixture agregada das referências admitidas. Não apresentar esse digest como recuperação do documento comercial completo, geração por LLM, autenticação de cliente ou execução de uma ação no CRM.

O pin completo está em `ops/faisca/agents/pin.json`, incluindo a SHA Agents e os hashes dos 19 arquivos necessários. A candidata Agents deriva da P67 [#476](https://github.com/rafhael100/imagine-ai-agents/pull/476), SHA `0c722eee6bd53a7ee46c4ba68ab70200fc191b78`. O runtime R03 continua sendo o único ledger; consulta não redispara PHP. Um processo encerrado sem recibo válido permanece incerto até descarte da sessão, sem recuperação entre reinícios.

## Próximo recorte R06: conhecimento comercial verificável

Avançar da validação de referências para uma recuperação limitada de **trechos comerciais efetivamente usados** na resposta, ainda em laboratório e com provedor determinístico. O objetivo é demonstrar a relação entre pergunta, trecho aprovado, resposta e fonte antes de introduzir geração externa.

1. Revalidar HEADs e instruções nos dois repositórios e localizar frentes concorrentes. Não presumir que as candidatas R02–R05 foram integradas.
2. Usar as fontes públicas e jornadas já curadas; definir trechos, identificação, versão, validade e limites de tamanho. Preservar o tratamento de conteúdo recuperado como dado sem autoridade para instruir ferramentas.
3. Adaptar a passagem de conhecimento à fronteira Agents com contrato próprio e testes de correspondência. Não relaxar silenciosamente os limites de 256 bytes do contrato original de sugestão ou os limites do retriever existente.
4. Criar um conjunto pequeno e revisável de perguntas reais do domínio, usando dados fictícios, para medir resposta com suporte, ausência de fonte, ambiguidade, contradição e recusa. A resposta deve indicar quando o catálogo não sustenta uma conclusão.
5. Preservar a UI, o ledger, a conciliação e os contratos já exercitados. Validar revogação e alteração da fonte entre seleção e entrega; uma resposta tardia não herda automaticamente a autoridade anterior.
6. Documentar separadamente o contrato de um futuro modelo: entrada permitida, saída estruturada, grounding, limites de uso, retenção e comportamento indisponível. Integração paga, conta de provedor e dados reais exigem escopo concreto próprio; não são necessários para concluir este laboratório.
7. Publicar código, contrato e evidências em PRs de rascunho vinculados. Vincular resultados às SHAs efetivamente executadas.

## Frentes paralelas que não devem ser misturadas

Na preparação R05, o Comercial tinha [#454](https://github.com/rafhael100/imagine-comercial/pull/454) e [#455](https://github.com/rafhael100/imagine-comercial/pull/455) em uma linha separada de segurança e pin SEO. A Central tinha [#475](https://github.com/rafhael100/imagine-ai-agents/pull/475) em linha própria. Essas frentes foram observadas, não incorporadas à candidata Faísca.

O receiver Central permanece privado/mTLS para eventos CRM; `MockSyntheticHttpEnvelope` é inerte. Nenhum desses contratos substitui a entrada pública de conversa. Laboratórios PostgreSQL conservam seus guards de CI descartável.

## Preservação e autorização

SHA-256 aprovado do PNG: `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`. Preservar imagem, recorte, cores, template base, estilos e jornadas. Manter laboratório fora de `src/pages`, `public`, sitemap e dist público. Não afrouxar F31/F32, allowlists, pins de Actions ou gates existentes.

A continuidade de desenvolvimento e publicação de código/documentação em branches de revisão está autorizada. Avançar nesse trabalho sem repetir o pedido de aprovação. Merge, deploy, VPS/DNS, gastos, dados reais e comunicação externa não decorrem de CI verde. Registrar impedimentos concretos e evidências de execução; não confundir código publicado para revisão com funcionalidade ativada em produção.
