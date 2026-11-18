# Codex — revisar R02 e desenvolver o contrato de conversa R03

17/11/2026, America/Sao_Paulo. Projeto Faísca, prioridade inicial Imagine Comercial. Preservar o modelo visual aprovado. Atividade existente: [Comercial #444](https://github.com/rafhael100/imagine-comercial/issues/444).

## Estado recebido

O pacote `Faisca_Implementacao_R02_Codex.zip` contém R01 + R02 em `source/`, patch consolidado, patch incremental R01→R02, manifesto SHA-256, testes e relatórios. Não repetir a tarefa R02 antiga como se nada estivesse implementado; comparar e reaproveitar.

Implementado: `mountFaisca`/`destroy`, isolamento por raiz, limpeza de listeners/timers, descarte de callbacks tardios, carga sob demanda, recuperação de carregamento parcial e wrapper Astro separado. O HTML continua demonstração guiada local, sem IA externa.

Base examinada: [Comercial #450](https://github.com/rafhael100/imagine-comercial/pull/450), branch `fix/comercial-heading-accuracy-pin-2026-11-17`, SHA `d38a4fc353bdfa277c47df4a46872fcd1c96f2d1`. A R01 usava #448; #450 estava dois commits à frente, sem alterações Faísca. Revalidar a candidata antes de aplicar; a main é documental.

## 1. Receber sem sobrescrever outra frente

1. Ler AGENTS, issue #444, manifesto, validação R02 e revisão independente.
2. Conferir hashes e PNG. Core e conhecimento permanecem iguais à R01.
3. Criar branch em checkout isolado da candidata revisada. Se R01 não existir, conferir com `git apply --check` e aplicar o patch consolidado. Se R01 já existir, comparar ou usar somente o incremental, também após `--check`. Não aplicar ambos.
4. Preservar árvore pública, F31/F32, canais allowlisted, catálogo e mudanças de outras frentes. Não alterar rulesets, automações ou VPS.

**Envio público autorizado:** Rafhael autorizou explicitamente publicar o mascote e os documentos R02 no repositório público `rafhael100/imagine-comercial`, na mensagem “autorizado, aprovado pode publicar o mascote e os documentos”. A rejeição automática anterior fica registrada como histórico; a autorização posterior atende ao conteúdo e destino. A entrega seguirá em branch de revisão e PR DRAFT. Merge e publicação operacional do site continuam fora deste escopo. Ver `AUTORIZACAO-PUBLICACAO-R02.md`.

## 2. Fechar a validação visual R02

Com navegador permitido e dependências fixadas:

```sh
npm ci --no-audit --no-fund
npm test
node ops/faisca/build-demo.mjs
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/browser-qa.mjs
node ops/faisca/lab/browser-qa.mjs
npm run build
node scripts/verify-dist.mjs
```

Seguir também QA e auditor SEO fixados na candidata. O Chromium falhou antes de abrir uma página nesta rodada; Cloud Desktop também ficou indisponível. Nenhum screenshot ou axe passou. Os 22 cenários standalone e 6 do wrapper estão preparados, não aprovados.

Validar três jornadas, Enter/Shift+Enter/IME/Esc, foco, minimizar/reabrir, reset pendente, clipboard tardio, montagem repetida/desmontagem/remontagem, roots independentes, movimento reduzido, sem JS, 320/390/1440 px, axe e ausência de envio de mensagens/persistência. O módulo da conversa só deve carregar após ativação; falha de import/open mantém retry.

Os 85 arquivos públicos ficaram idênticos byte a byte nesta rodada. Repetir comparação se mudar import/config/fonte pública. CSS global permanece apropriado apenas à página isolada; widget público não está integrado.

## 3. Prosseguir R03 em laboratório

Sem aguardar outra microaprovação para desenvolvimento local de baixo risco, preparar **contrato de conversa e provedor simulado**, como base da futura conversa livre com IA. Não conectar modelo pago nem anunciar IA real.

Auditoria Agents, em linhas separadas:

- [P65 #471](https://github.com/rafhael100/imagine-ai-agents/pull/471), SHA `740abafc813dbde70f5a2ad6e138402ed7945276`.
- [Central #472](https://github.com/rafhael100/imagine-ai-agents/pull/472), SHA `8e7f1f21a2927bde3e337edaace0e1e6dffdc29a`.

Não combinar branches automaticamente. Não foi localizada API de chat Faísca pronta nessas árvores. Revalidar HEADs e reaproveitar contratos existentes, sem outro motor de governança paralelo.

### Contrato proposto para implementação

1. Envelope de conversa versionado, ID da mensagem, referência opaca da conversa, idioma e entrada discriminada `text` ou `action`. IDs do visitante não autenticam cliente/empresa.
2. O futuro servidor determina produto, audiência, escopo e conhecimento. `tenant_id`, papel, permissão, ferramenta, preço ou provedor do browser não conferem autoridade.
3. Resposta textual, fontes versionadas e ações de interface em campos separados. Texto não cria lead, compra, contrato, pagamento ou mensagem a terceiro.
4. Provedor simulado por injeção, com sucesso, timeout, indisponibilidade, limite e cancelamento. Testar primeiro o contrato isolado; não ligar o browser a classes PHP ou receivers privados.
5. Fallback guiado honesto. Descartar resposta após reset/destroy/troca de conversa; recusar schema inválido, HTML executável, fontes desconhecidas e ações fora da allowlist.
6. Idempotência por conversa/mensagem + hash: repetição idêntica reaproveita resultado; ID repetido com corpo diferente retorna conflito. Separar cancelamento antes de envio, timeout com resultado desconhecido e conciliação. Não repetir automaticamente chamadas cobráveis desconhecidas.
7. Limites do mock não provam proteção operacional contra abuso/custos. Preço, prazo, desconto, disponibilidade e estado do cliente dependem futuramente de fonte oficial e autorização; não inventar.

### Reuso identificado

| Componente | Uso a avaliar | Limite |
|---|---|---|
| `src/Contracts/AiSuggestionProvider.php` | Adaptar sugestão/resposta | Sugestão não concede efeito |
| `src/MockOrchestration/SupervisedCoordinator.php` | Separar sugestão/execução | Processo e contexto sintéticos |
| `src/MockOrchestration/MockAiOrAutomationRouter.php` | Regra × modelo | Não recebe texto livre nem executa modelo |
| `src/MockKnowledge/MockKnowledgeRetriever.php` | Contexto/versionamento | Fontes/grants sintéticos revalidados na entrega |
| `src/MockUsage/MockUsagePolicy.php` e `MockUsageLedger.php` | Uso observado | Voláteis; não são reserva transacional |
| `tools/labs/PgAiCreditReservationLab.php` | Referência de reserva/conciliação | CI descartável; preservar guard |
| `tools/labs/PgSyntheticReplayGate.php` | Referência de deduplicação | Não é sessão de chat pronta |

O receiver `runtime/central-auto/index.php` recebe eventos privados CRM com identidade de serviço e envelope fechado. Não transformá-lo em endpoint browser/chat, enviar texto livre ou remover guards CI-only. Voz e pedidos autenticados ficam fora desta etapa.

### Aceite R03

Contrato e adaptador simulado com testes reais; integração UI apenas no laboratório; conhecimento versionado; falhas explícitas; idempotência/conflito/cancelamento testados; capacidades reais desligadas; revisão independente e pacote reproduzível. Não usar porcentagem arbitrária.

Quando uma frente bloquear, continuar tarefas independentes já autorizadas. Registrar impedimento concreto, sem inventar execução. A publicação deste pacote no GitHub está autorizada. Merge, deploy operacional, VPS/DNS, compra, chamada paga e dados reais continuam fora desta instrução.
