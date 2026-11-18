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
node --test tests/faisca-r09-model-router.test.mjs
```

Os testes cobrem pré-validação, candidatos fechados, respostas fundamentadas, clarificação, falta de suporte, injeção de instruções, saída com texto inventado, ações de CRM e requisições clonadas.

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
