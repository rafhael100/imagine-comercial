# Faísca R09-A — roteamento conversacional fundamentado

**Branch:** feat/faisca-r09-grounded-router-2026-11-18  
**Base:** R08-A/B/D, PR #469  
**Status:** contrato e fixture sintética; nenhum provedor externo conectado.

## Objetivo

Preparar uma camada de roteamento conversacional que permita interpretar perguntas em linguagem natural e selecionar uma resposta editorial aprovada, sem permitir que um modelo invente preço, prazo, funcionalidade, ação operacional ou dado de cliente.

## Como funcionará

1. O host recebe a mensagem e aplica a pré-validação local de conteúdo sensível, credenciais e instruções indevidas.
2. O host consulta a base editorial R06 e monta um conjunto fechado de respostas candidatas.
3. Um futuro provedor de IA poderá escolher apenas um `answerId` desse conjunto, pedir uma clarificação aprovada ou declarar que não há suporte.
4. O servidor valida o ID escolhido contra a requisição confiável e a versão do catálogo.
5. O host renderiza o texto exato da resposta R06, as fontes e as ações aprovadas. O modelo não escreve a resposta final nem escolhe ferramentas.
6. Se não houver fonte candidata, a resposta é um fallback fixo ou uma pergunta de esclarecimento.

## Contrato R09-A

Arquivos: `ops/faisca/model-router/contract.mjs` e `ops/faisca/model-router/demo.mjs`.

Antes de montar a requisição, `retrieveCandidateAnswerIds` faz uma recuperação determinística e limitada sobre os títulos, prefixos, sufixos e trechos do catálogo R06. O resultado contém no máximo cinco IDs de resposta aprovados. A busca lexical serve apenas para reduzir o conjunto de candidatos; não é IA semântica e não prova que a pergunta foi compreendida. Sem correspondência, o roteador não inventa candidato e usa a saída fixa de ausência de suporte.

`routeWithLocalFixture` percorre a sequência completa host → recuperação → requisição fechada → fixture sintética → verificação → texto editorial exato. É apenas uma demonstração offline, não um provedor de IA.

- Requisição `faisca.model-route.request.v1`: IDs opacos, pergunta filtrada, candidatos editoriais e clarificações permitidas.
- Resposta `faisca.model-route.response.v1`: `routeStatus`, `answerId` e/ou `clarificationId`; nenhum texto livre, URL, ação, ferramenta, preço ou dado de contato.
- `verifyModelRouteResponse` recusa resposta fora do conjunto de candidatos, citação fora de assunto, versão/ID incorretos, campos extras e tentativa de incluir texto ou ferramenta.
- `localModelRouteFixture` é somente teste sintético, sem rede, chave, chamada de modelo ou custo.

O contrato reduz a liberdade do modelo de propósito: ele pode ajudar a entender a intenção e selecionar o trecho certo; o conteúdo factual continua vindo da base editorial revisada. A experiência de conversa aberta e a geração de texto livre não estão habilitadas nesta etapa.

## Testes

```bash
node --test tests/faisca-r09-*.test.mjs
node ops/faisca/model-router/demo.mjs
```

Os testes cobrem recuperação lexical em português com acentos, pré-validação, candidatos fechados, respostas fundamentadas, clarificação, falta de suporte, injeção de instruções, saída com texto inventado, ações de CRM, requisições clonadas e repetibilidade da demonstração offline.

## Decisão necessária antes de IA real

A conexão de um provedor LLM exige escolha explícita de provedor/modelo, orçamento e limites de custo, região/processamento, retenção e privacidade. Também exige avaliar o envio do texto da pergunta a terceiro e formalizar a política de fontes. Nenhuma dessas decisões é presumida pelo código.

## Não fazer nesta fase

- Não adicionar SDK ou endpoint externo.
- Não criar, armazenar ou pedir chave de API.
- Não enviar texto de visitante a qualquer serviço.
- Não permitir resposta factual livre nem ferramentas.
- Não conectar CRM, Portal, pagamento, e-mail ou mensageria.
- Não publicar, fazer deploy ou alterar o site público.

**R09-A é apenas a fronteira local de roteamento.** A IA generativa real permanece desativada até aprovação específica.

## R09-B — runtime local, idempotência e conciliação

Arquivo: `ops/faisca/model-router/runtime.mjs`.

O runtime aceita exclusivamente `provider.kind='simulated'`; qualquer provedor externo é recusado. Ele reutiliza os mesmos princípios de segurança já aplicados ao runtime de conversa:
- chave por `conversationId + messageId`;
- mesmo ID e mesmo conteúdo reutilizam a operação; conteúdo diferente com o mesmo ID recebe conflito;
- somente uma rota não resolvida por conversa;
- ausência de candidatos editoriais responde localmente, sem despacho;
- timeout retorna `unknown`, não reenvia e bloqueia nova mensagem até conciliação;
- resultado tardio só aparece por `reconcile`;
- `destroy` encerra o runtime e descarta respostas tardias.

A implementação é volátil e de processo único. Não representa persistência, garantia distribuída de exactly-once, reserva de orçamento ou integração com um provedor real. O contador `externalModelInvocations` permanece zero.

Reprodução:
```bash
node --test tests/faisca-r09-*.test.mjs
node ops/faisca/model-router/demo.mjs
```

## R09-C — pipeline R09 → R06/PHP

Arquivo: `ops/faisca/model-router/grounded-pipeline.mjs`.

O pipeline encadeia a seleção de uma resposta candidata R06 com a validação independente do texto e das fontes pelo PHP real do Imagine Agents. O roteador pode selecionar apenas um candidato editorial; a resposta só é exibida depois de o PHP confirmar o candidato exato.

Respostas que representam seleção de serviço (Onepage, Landing Page ou canais individuais de anúncios) não são tratadas como contratação nem gravadas no resumo. O host interrompe a etapa e faz uma pergunta fixa de esclarecimento. Respostas sem candidato não iniciam PHP. Se a validação PHP falhar ou ficar incerta, texto e fontes editoriais não são apresentados como confirmados.

O gate real `ops/faisca/model-router/check-grounded-pipeline.mjs` executa o fluxo com a fixture local de roteamento e o PHP CLI real do Agents fixado no CI. Ele verifica perguntas sobre processo, preço e comparação, além de esclarecimento de serviço, ausência de fonte e pré-validação de dados pessoais. Não há modelo externo.

Reprodução no ambiente CI com PHP e pin Agents configurados:
```bash
node ops/faisca/model-router/check-grounded-pipeline.mjs
```

## R09-D — interpretação de respostas livres para campos de qualificação

Arquivos: `ops/faisca/model-router/field-contract.mjs` e integração local em `ops/faisca/qualification/journey.mjs`.

A qualificação R08 continua armazenando apenas valores enumerados. A nova fronteira `faisca.model-field.request.v1/response.v1` permite que um futuro modelo classifique uma resposta escrita pelo visitante em uma das opções permitidas para a pergunta atual. A saída não contém texto livre: somente `matched`, `ambiguous` ou `unknown`, com um valor fechado ou `null`.

A fixture local reconhece expressões portuguesas explícitas para objetivo, público, materiais, previsão e preferência de contato. Se houver duas interpretações, não escolhe nenhuma; reapresenta as opções. Se não houver correspondência, a conversa continua pelo roteador comercial R07. A mensagem “Quero captar leads” durante a pergunta de objetivo é registrada como objetivo `capture_leads`, não como troca automática para Landing Page.

Uma proposta de troca de serviço agora preserva o perfil atual enquanto aguarda confirmação. Se o visitante cancelar, retoma a qualificação anterior. Se confirmar Onepage/Landing Page, inicia um perfil novo para o serviço confirmado. Serviços sem questionário R08 aprovado continuam sem qualificação inventada.

Esta implementação é determinística e local. Nenhum modelo externo é chamado; a estrutura prepara o ponto de integração futuro, sujeito a aprovação de provedor, privacidade e custos.
