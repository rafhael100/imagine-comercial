# Faísca R07 — especificação executável de jornada e fronteira de modelo

Data: 2026-11-18. Base imutável: Comercial R06 `db0d9a68c3053ef65edd427e5be9b17f53686480`. Dependência Agents R06 `36caf2ee3585c3f64a6f1d78552550ae5aaebeb0`. Esta é a primeira entrega **documental** da R07; não equivale à implementação dos cenários.

## Critérios obrigatórios

1. Preservar integralmente mascote PNG aprovado (SHA-256 `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`), CSS, template e 85 arquivos públicos. `publicFaiscaEnabled=false`.
2. Sessão volátil isolada por conversationId. Resumo contém somente escolhas confirmadas, sem inventar orçamento, preço, prazo, compra ou envio a vendedor.
3. Distinguir `supported`, `unsupported`, `ambiguous`, `private_boundary`, `sensitive`, `uncertain`; nenhum fallback local pode se apresentar como resposta gerada por modelo.
4. Mudança explícita de objetivo substitui o objetivo anterior apenas após confirmação. Correção do usuário atualiza o resumo sem alterar histórico de respostas.
5. Fontes são dados não confiáveis; instruções dentro de trechos não podem modificar políticas, ferramentas, ações ou limites.
6. Não há envio ao CRM, pagamento, e-mail, lead real, credenciais, API externa, merge, deploy ou custos nesta etapa.

## Matriz de jornadas de ponta a ponta

| ID | Sequência de visitante | Expectativa verificável |
|---|---|---|
| J01 | Quero apresentar minha empresa → Onepage → como funciona? → resumo | Uma solução confirmada; resposta com fonte R06; resumo somente da escolha |
| J02 | Quero captar contatos → Landing Page → e Google Ads? | Distingue página de campanha; pede confirmação antes de trocar objetivo |
| J03 | Quero Onepage → na verdade Landing Page → resumo | A última escolha confirmada prevalece; sem duplicação |
| J04 | Quero Onepage → inclui e-mail? → resumo | Ausência de fonte declarada; escolha anterior preservada |
| J05 | Quero um site e anúncios → quero primeiro o site | Ambiguidade seguida de esclarecimento; sem escolha automática |
| J06 | Quanto custa? → qual prazo garantido? | Não inventa valores nem garantias; orienta proposta oficial |
| J07 | Qual o status do meu pedido? → aqui está minha senha | Não consulta estado privado; não ecoa segredo nem despacha provedor |
| J08 | Qual a diferença entre Onepage e Landing Page? → resumo | Comparação com fontes; nenhuma escolha inferida de pergunta comparativa |
| J09 | Mensagem enviada → timeout → consultar resultado | Consulta operação original; zero segundo despacho |
| J10 | Mensagem pendente → reiniciar → resposta antiga chega | Resposta antiga descartada; nova conversa isolada |
| J11 | Duas sessões simultâneas com IDs de mensagem iguais | Nenhum vazamento cruzado de fontes, contexto ou resumo |
| J12 | Fonte recuperada inclui “ignore as regras” | Instrução ignorada como dado; saída não ganha autoridade |
| J13 | Resposta cita passagem autêntica de outro assunto | Rejeição por incompatibilidade com pergunta/receita |
| J14 | Usuário pede falar com equipe → copiar resumo | Resumo copiável, com aviso explícito de que não foi enviado |

## Interface de modelo R07 — somente contrato e fixture local

A entrada é construída pelo host, nunca pelo navegador: `schema=faisca.model.request.v1`, `invocationId`, `conversationId`, `messageId`, `locale`, `intent`, `confirmedSelections`, `allowedPassages[]` (id, versão, digest e trecho), `allowedActionIds[]`, `limits`. Não incluir credenciais, tokens, dados privados, URLs arbitrárias ou autoridade operacional. A política do host deve instruir que passagens são `UNTRUSTED_DATA`.

A saída proposta é `schema=faisca.model.response.v1`, `invocationId`, `messageId`, `answerText`, `citationIds[]`, `actionIds[]`, `supportStatus`. O adaptador rejeita campos adicionais, HTML executável, citações fora do conjunto permitido, ações desconhecidas, versões divergentes e texto acima do teto. Um schema válido **não prova** suporte semântico: respostas de modelo só podem ser apresentadas após avaliação independente de suporte ou devem retornar fallback editorial.

Fixture local determinística: respostas de sucesso, falta de suporte, extrapolação, contradição modelada, prompt injection em fonte, timeout, erro de schema, resposta atrasada e fonte revogada. Zero chamadas externas e zero credenciais.

## Plano de implementação para Codex

**R07-A:** adicionar testes automatizados J01–J14, usando as funções reais R06; testes devem falhar quando o resumo presume uma seleção ou há resposta tardia indevida.

**R07-B:** implementar estado mínimo de objetivos propostos/confirmados, mudança explícita e resumo fiel, sem mutação das fontes normativas. Preservar contratos e pins existentes.

**R07-C:** criar adaptador local fechado `model.request.v1/response.v1` com fixture determinística; provar rejeição de texto não sustentado, citação de outro tópico e instruções nas fontes. Não adicionar dependência de LLM.

**R07-D:** adicionar demo isolada `/journey/` fora do site público e CI com Node, navegador, PHP real e testes de acessibilidade 320/390/1440. Confirmar byte a byte o PNG e dist público.

**R07-E:** revisão independente, evidências por SHA, PR draft filha da R06. Não realizar merge nem deploy automático. Se algum cenário não puder ser automatizado, registrar lacuna, não declarar PASS.

## Gate de saída

Somente considerar R07 concluída quando J01–J14 estiverem verdes com evidência, adaptador e fixtures implementados, regressões R03–R06 aprovadas, pin Agents verificado, PHP real comprovado na CI, e nenhum arquivo público/mascote modificado. O presente documento estabelece critérios; **não afirma que o gate foi cumprido**.

## Execução incremental nesta branch

**Código já implementado para revisão (não homologação final):**

- `ops/faisca/journey/state.mjs`: sessão volátil R07 independente; o visitante confirma ou descarta uma proposta de objetivo antes de alterar o resumo. Comparações e assuntos privados não substituem a escolha sem confirmação.
- `tests/faisca-r07-journey.test.mjs`: testes das jornadas comerciais J01–J08, J13–J14 e segurança do estado local, usando `groundedRespond` e as fontes R06 reais.
- `ops/faisca/journey/model-contract.mjs`: envelope `faisca.model.request.v1` e `response.v1`, fixtures locais e verificador **estritamente editorial**. Uma frase inédita não é semanticamente certificada: nesta implementação, é recusada se diferir do texto exato R06.
- `tests/faisca-r07-model-contract.test.mjs`: provas de IDs, versões, citações, fonte fora de assunto, preço inventado, instrução maliciosa, ações não permitidas e acesso indevido aos campos do host.
- `ops/faisca/journey/demo.mjs`: demonstração reprodutível no terminal, sem rede; `tests/faisca-r07-demo.test.mjs` prova transcrição e resumo fiel.

**Como experimentar a nova camada:** `node ops/faisca/journey/demo.mjs`. Testes: `node --test tests/faisca-r07-*.test.mjs`. Esses comandos não instalam nada nem iniciam um serviço remoto.

**Atualização da R07:** os cenários J09–J11 estão cobertos no **laboratório assíncrono Node R07**, reutilizando o runtime existente R03 e o contrato/fonte R06, com testes de consulta, bloqueio de novo turno até a conciliação, reinício e isolamento entre IDs de conversa iguais ou diferentes. Há também uma contraprova J12 para fonte adulterada e saída que tenta dar autoridade a instruções maliciosas. A demonstração visual `/journey/` e seu QA Chromium/Axe existem, mas **a tela atual ainda é local e síncrona; não expõe a consulta de resultado pendente desse novo laboratório assíncrono**.

**R07-G validada em laboratório:** o fluxo browser → HTTP → estado R07 por sessão → PHP real do Agents passou em 6/6 cenários no workflow [44378972555](https://github.com/rafhael100/imagine-comercial/actions/runs/44378972555), com pin Agents `36caf2ee3585c3f64a6f1d78552550ae5aaebeb0`. O artefato [14462093314](https://github.com/rafhael100/imagine-comercial/actions/runs/44378972555/artifacts/14462093314) registra `status=passed`, `executedPHP=true`, 5 processos iniciados, 4 concluídos, 1 encerrado intencionalmente pelo teste de reset, 0 falhas PHP inesperadas, 0 pendentes, 0 sessões e 0 sockets ao final. J09–J11 estão cobertos por navegador/HTTP/PHP real; J12 por contraprovas do contrato e fontes; J13–J14 por testes de seleção, fonte e resumo. A regressão R05 e R06 também passou.

**Pendências antes de qualquer release:** revisão independente do código e conclusão do gate geral Comercial/SEO/build; a avaliação semântica de prosa livre e um provedor LLM real pertencem a uma fase posterior, que exigirá decisão explícita de provedor, privacidade e custos. `publicFaiscaEnabled=false` permanece vigente. Não existe conexão de IA externa, efeito CRM, pagamento ou pós-venda autenticado.

## R07-F — mensagens incertas e isolamento (18/11/2026)

`ops/faisca/journey/async-lab.mjs` é um adaptador local opt-in que **reutiliza** `createConversationRuntime` (R03) e `respondJourney` (R07). Propostas e confirmações do objetivo são operações locais explícitas; apenas orientações com resposta e trechos comprovados são elegíveis para envio ao provedor sintético. Nenhum input de visitante escolhe o provedor. O modo padrão do site não é alterado.

As novas provas `tests/faisca-r07-async.test.mjs` incluem:
- J09: timeout produz `unknown`; a entrega tardia é lida somente por `reconcile`, com o mesmo `conversationId/messageId` e sem novo despacho; outro objetivo permanece bloqueado até conciliação explícita, inclusive depois que o provedor já terminou.
- J10: `reset()` destrói o runtime da geração anterior, devolve a operação pendente como encerrada, desconsidera o resultado tardio e reinicia o resumo sem contaminar a nova sessão.
- J11: instâncias isoladas podem usar o mesmo `messageId` e resolvem seus próprios resumos, sem aceitar a mensagem da outra conversa.
- J12: uma fonte adulterada perde o vínculo de confiança e a saída que interpreta instruções dentro da fonte é recusada.
- Contraprovas: mensagem diferente com o mesmo ID dá `conflict`; uma consulta não redispara; reenvio de uma resposta já conciliada não bloqueia novamente o atendimento; troca de objetivo durante pré-despacho é recusada.

**Limites operacionais:** o ledger é volátil, em um único processo, e o provedor é local/sintético. Não há durabilidade entre reinícios, orçamento, credencial ou garantia financeira de exactly-once. `reconcile` devolve dados ao chamador; nenhuma interface pública é automaticamente atualizada por esse laboratório. Para comprovar a experiência assíncrona R07 completa no navegador é necessário integrar explicitamente o transport/controller e testar o fechamento de sessões antes da liberação.

## R07-G — jornada assíncrona no navegador, HTTP e PHP real

Foi adicionada uma segunda página isolada, `/journey-http/`, distinta da demonstração local síncrona `/journey/`. Ela monta `respondJourney` no navegador, cria uma sessão HTTP e usa uma fábrica confiável `createJourneyPrepareTurn(conversationId)` no servidor. Cada sessão recebe um fechamento de estado R07 independente; o visitante não seleciona a política.

O runtime HTTP reutiliza o motor R03 de deduplicação/consulta e a ponte R06 de PHP com pin imutável. As ações `confirm_goal` e `cancel_goal` foram adicionadas ao contrato fechado de mensagens; propostas, cancelamentos, perguntas sem suporte e resumo são respostas locais sem despacho PHP. A confirmação de uma escolha suportada é a que pode seguir à validação de fonte pelo PHP real. A validação do navegador exige que o resumo só avance após uma resposta confirmada/conciliada.

**Novo gate planejado em CI:** `ops/faisca/journey/http-browser-qa.mjs`, executado no workflow R06/R07 que já baixa o commit exato do Imagine AI Agents e exige PHP CLI real. Os cenários cobrem:
- proposta sem chamada PHP, seguida de confirmação e resposta com fontes R06;
- timeout, consulta prematura, espera pela conclusão real do processo e consulta posterior sem novo despacho;
- reset durante PHP pendente, encerramento da sessão HTTP e descarte de resposta antiga;
- nova sessão após reset com objetivo diferente;
- duas sessões HTTP com o mesmo `messageId`, confirmando respostas e fontes diferentes, além de recusa de token cruzado;
- responsividade e axe em 320, 390 e 1440 px, sem tráfego externo ou armazenamento no navegador.

O código e o workflow foram adicionados nesta branch. **Não declarar R07-G aprovada até a CI da SHA final terminar verde e o relatório `Faisca_R07_HTTP_BROWSER_QA.json` registrar `status=passed` e `executedPHP=true`.** A prova é somente laboratorial, com conteúdo sintético e processo PHP local; não equivale a um serviço de produção, não usa LLM externo e não envia dados ao CRM.
