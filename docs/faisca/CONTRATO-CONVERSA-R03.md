# Faísca R03 — contrato de conversa e provedor simulado

Referência: 17/11/2026, America/Sao_Paulo. Continuidade da [atividade #444](https://github.com/rafhael100/imagine-comercial/issues/444) e da [R02 #452](https://github.com/rafhael100/imagine-comercial/pull/452), base `c833c12ff34aaeba56549ae5dc41763a6a909b2a`.

## Resultado desta etapa

O laboratório passa pelo mesmo limite de mensagem que uma integração posterior deverá respeitar: entrada fechada, resposta correlacionada, fontes versionadas, ações de interface e tratamento explícito de falhas. O provedor desta entrega é determinístico, local e simulado. A demonstração autocontida continua com o atendimento guiado.

O PNG, o template do mascote e seu CSS permanecem preservados. O seletor de cenários fica na barra do laboratório. Não é uma escolha de modelo ou provedor operacional.

## Autoridade e integração futura

O browser informa somente a mensagem. Produto, audiência, versão do conhecimento, catálogo, provedor e ações permitidas são configuração do código confiável. Não existem campos de tenant, papel, permissão, ferramentas, preço, URL ou credencial no envelope. IDs opacos correlacionam a conversa; não autenticam empresa ou cliente.

O servidor futuro deverá aplicar identidade, escopo, quotas persistentes e autorização. O estado local desta entrega não concede essas capacidades. Texto de resposta não cria lead, chamado, contrato, compra, pagamento ou mensagem à equipe.

## Entrada v1

```json
{
  "schema": "faisca.conversation.v1",
  "conversationId": "conversation_synthetic_01",
  "messageId": "message_synthetic_0001",
  "locale": "pt-BR",
  "input": { "type": "action", "id": "sell" }
}
```

`input` aceita exclusivamente `{type:"text",text}` ou `{type:"action",id}`. Texto deve conter entre 1 e 800 pontos de código Unicode; ações pertencem ao catálogo existente. IDs usam 8–96 caracteres ASCII alfanuméricos, `_` ou `-`. Campos extras, accessors, símbolos, protótipos inesperados e formatos incompletos são recusados. A interface gera novos UUIDs para cada mensagem e para cada reinício.

Somente `pt-BR` tem conteúdo revisado nesta fase. Não aceitar idioma diferente e responder silenciosamente em português. Entrada reconhecida como sensível ou instrução proibida recebe orientação guiada antes de qualquer chamada ao simulador; a heurística existente não é uma garantia operacional de detecção de dados pessoais.

## Resposta v1

```json
{
  "schema": "faisca.response.v1",
  "conversationId": "conversation_synthetic_01",
  "messageId": "message_synthetic_0001",
  "locale": "pt-BR",
  "knowledgeVersion": "faisca-editorial-1",
  "text": "Texto proveniente da orientação editorial local.",
  "sources": [{ "id": "faisca.journeys@1", "version": "faisca-editorial-1" }],
  "actions": [{ "id": "home" }]
}
```

O exemplo descreve o formato; não é um candidato executável pronto. Conversa, mensagem e idioma devem corresponder à entrada. Texto é limitado a 3.000 pontos de código e recusa marcação HTML e controles não permitidos. Fontes são únicas e conhecidas, com versão exata; ações são únicas e pertencem à navegação existente. Títulos de fontes e rótulos dos botões são resolvidos no catálogo local, não fornecidos pelo modelo. A UI insere texto com `textContent`.

**No modo simulado, também se exige correspondência integral ao candidato editorial preparado pelo núcleo:** texto, fontes e ações. Uma resposta estruturalmente válida que invente um preço ou declare pagamento confirmado é recusada. Validar um schema, isoladamente, não prova veracidade. A adoção futura de respostas livres exige outra política de conhecimento e revisão, sem retirar esta restrição do simulador para conectar um modelo diretamente.

## Idempotência e resultados incertos

A chave é conversa + mensagem. O fingerprint SHA-256 usa a serialização canônica de toda a entrada validada, incluindo schema, idioma e conteúdo. A ordem das propriedades do JSON não muda o fingerprint.

| Situação | Comportamento |
|---|---|
| Repetição idêntica em curso | Compartilha a chamada existente |
| Repetição idêntica concluída | Reaproveita o resultado registrado |
| Mesmo ID com conteúdo diferente | `conflict`, sem nova chamada |
| Capacidade esgotada | `limit`, sem expulsar registros anteriores |
| Sinal cancelado antes de um novo envio | `cancelled`, zero chamadas |
| Cancelamento ou timeout depois do envio | `unknown`; nenhuma repetição automática |
| Outra mensagem durante resultado pendente | `busy`, preservando o contexto anterior |
| Resposta tardia | Registrada para `reconcile`; não inserida automaticamente na UI |
| Reinício ou desmontagem | Novo contexto local; callbacks da geração anterior são descartados |

Um replay com sinal já cancelado não reclassifica como "cancelada antes do envio" uma mensagem que já foi enviada. `reconcile` valida a mesma identificação e fingerprint e consulta o resultado existente; nunca chama o provedor novamente.

Os limites são de memória de um processo: 64 registros por instância no laboratório, máximo configurável de 256. Não há persistência, exclusão de evidência para liberar capacidade, proteção distribuída ou reserva financeira. Fechar a página encerra esse estado. Cancelar a interface não comprova cancelamento nem custo zero de um provedor real.

## Estados e fallback na interface

| Cenário do laboratório | Status | Entrega |
|---|---|---|
| Atendimento normal | `answered` | `simulated` |
| Provedor indisponível | `unavailable` | `guided_fallback` |
| Limite do provedor | `provider_limit` | `guided_fallback` |
| Resposta inválida | `invalid_response` | `guided_fallback` |
| Resposta demorada | `unknown` | `unknown`, com orientação local identificada |

O resultado inclui `accepted`: somente turnos aceitos atualizam o resumo guiado. Recusas por conflito, capacidade, estado fechado ou conversa ocupada preservam o resumo. Indisponibilidade e resposta inválida mostram aviso e continuam com a base editorial. Tempo limite informa resultado incerto e ausência de nova tentativa.

O reset destrói o runtime anterior e gera outra conversa; a troca de cenário também exige nova ativação. Desconectar o componente elimina listeners, temporizadores e instância. O próximo rascunho digitado durante a espera é preservado. Diagnósticos `data-faisca-status` e `data-faisca-delivery` são locais e apagados ao reiniciar; não são telemetria.

## Reuso do Imagine Agents

A revisão consultou, sem combinar branches, [Agents #471](https://github.com/rafhael100/imagine-ai-agents/pull/471) em `740abafc813dbde70f5a2ad6e138402ed7945276` e [Central #472](https://github.com/rafhael100/imagine-ai-agents/pull/472) em `8e7f1f21a2927bde3e337edaace0e1e6dffdc29a`.

- `AiSuggestionProvider` e `SupervisedCoordinator`: sugestão separada de execução; reserva antes do envio e conciliação após incerteza.
- `MockKnowledgeRetriever` e `MockContextEnvelope`: fontes e versões controladas pelo contexto confiável.
- `MockUsageLedger`: deduplicação, conflitos e capacidade limitada; não confundir registro observado com autorização de custo.
- Laboratórios PostgreSQL permanecem sob seus guards de CI. O receiver privado da Central recebe eventos CRM com identidade de serviço; não é endpoint browser/chat.

A R03 usa esses invariantes no contrato de laboratório, sem duplicar um motor operacional ou expor as classes PHP ao visitante.

## Arquivos e continuidade

`conversation-contract.mjs` define o limite de dados; `conversation-runtime.mjs` coordena estados; `simulated-provider.mjs` fornece os cenários locais; `lab/conversation-ui.mjs` monta a integração com o componente existente. Nenhum desses módulos é importado pela árvore pública de produção.

O próximo incremento deve exercitar a fronteira de servidor e transporte em laboratório, reaproveitando os contratos do Agents. Identidade e quotas persistentes, conteúdo oficial, integrações com Portal/CRM e provedor real têm de ser resolvidos nesse lado do sistema antes de ativar conversa livre no Comercial. Manter branches e PRs de revisão e os limites de custo e operação já estabelecidos.
