# Faísca R47 — preparar seleção editorial por IA sem transmitir texto do visitante

**Base:** Faísca R46 [#510](https://github.com/rafhael100/imagine-comercial/pull/510). **Tipo:** contrato e ensaio local de privacidade para futura integração de um provedor de classificação; não é ativação de IA externa.

## Necessidade

O roteador R09 já recusa mensagens privadas, impõe limites e valida a seleção de respostas editoriais no R06. Entretanto, seu objeto interno contém `userText`, IDs da conversa e passagens completas para classificação. Uma futura implementação que simplesmente enviasse esse objeto integral para um fornecedor poderia expor perguntas identificáveis ou dados não detectados pelas heurísticas de PII.

A preparação para IA real deve ter **um contrato explícito de saída menor que o objeto interno do roteador**. R47 é esse contrato, não uma permissão para usar um fornecedor.

## Código implementado

- `ops/faisca/model-router/contract.mjs` exporta `buildCandidateOnlyRouteEgress(request)`, que aceita apenas objetos R09 criados pela fábrica do host e marcados internamente como confiáveis. Clones, objetos com getter e requisições recusadas no preflight não geram envelope.
- O envelope `faisca.model-route.candidate-only-egress.v1` contém somente `locale`, versão pública do catálogo, **IDs das respostas editoriais já ranqueadas pelo host**, IDs de esclarecimento fixos e limites fechados de tamanho/quantidade. Não leva o texto livre, ID da mensagem, ID da conversa, `invocationId` derivado do usuário, empresa, contato, fontes extensas, URL de backend, login, token, preço, pedido, ferramentas nem ações de negócio.
- `ops/faisca/model-router/egress-fixture.mjs` implementa um **seletor local determinístico** `kind=simulated` que escolhe o primeiro ID já revisado e devolve apenas `answerId` para validação pelo host. Ele **não é um modelo de IA** e não faz HTTP/fetch/telemetria.
- A resposta exibida continua vindo do R06, após a verificação do texto e das fontes. A classificação futura nunca poderá gerar, por si, um preço, contrato, resposta financeira, instrução de CRM ou afirmação de pagamento.

## Verificação

`tests/faisca-r47-candidate-only-egress.test.mjs` prova:

1. envelope mínimo sem texto do visitante ou correlação identificável;
2. rejeição de mensagens privadas, instruções hostis, objetos forjados ou getter;
3. rejeição de perguntas sem candidato editorial;
4. integridade do resultado do seletor de laboratório, sem texto nem citações gerados pelo classificador;
5. cadeia R09→R06 retornando a resposta e as fontes oficiais de laboratório, com replay sem duplicação e `externalModelInvocations=0`.

O CI de Faísca precisa passar na SHA exata. O envelope não substitui DLP/LLM real nem remove a necessidade de privacidade e consentimento, mas restringe materialmente a superfície futura de egress.

## Limite funcional e próximo gate

Sem receber o texto bruto, um modelo externo teria apenas os candidatos pré-ranqueados e poderia no máximo selecionar ou pedir esclarecimento. Para oferecer compreensão generativa mais sofisticada, será necessária **decisão explícita de produto** sobre dados que podem sair do servidor, base legal/aviso, DPA/região/retenção do fornecedor, anonimização efetiva e revisão independente. Não aumentar a carga do envelope por conveniência do provedor.

Nenhum serviço externo, gasto, segredo, modelo, chamada de rede, CRM, Portal, cobrança, deploy ou alteração do mascote foi criado nesta PR. Todos os recursos permanecem em revisão privada.
