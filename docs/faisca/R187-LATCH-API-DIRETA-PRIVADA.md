# Faísca R187 — bloqueio de reenvio após resultado incerto da API

## Problema

O servidor HTTP privado da R108 já bloqueava novos despachos quando um
provider lançava exceção ou expirava. Entretanto, o adaptador
`createFaiscaOpenAILiveLab` também pode ser invocado diretamente pelos
scripts de laboratório. Antes desta entrega, uma falha de transporte na Luna
ou Terra não bloqueava uma segunda chamada explícita nessa mesma instância.

## Correção

- O adaptador mantém `providerCompletionUncertain` apenas na memória do
  processo e o marca quando um despacho já reservado termina em exceção,
  timeout ou resposta HTTP/API não validada.
- Chamadas subsequentes de `invoke` recusam o transporte antes de reservar
  mais créditos e antes de chamar `fetchImpl`. Não há retry, reembolso,
  reinicialização automática ou registro da pergunta.
- Rejeições editoriais após uma resposta de rede válida e decisões
  `answerId: none` não são confundidas com falha de transporte.
- O mecanismo complementa, mas **não substitui**, ledger durável R82,
  guarda HTTP R108 ou verificação independente de cobrança.

## Testes

`node --test tests/faisca-r187-private-provider-adapter-latch.test.mjs`

Cobre falha sintética 503 na Luna, 503 na Terra, conversa fictícia privada
com falha da Terra, e uma decisão válida `none` sem travamento indevido.
Todos os transportes são injetados: não existe acesso real à OpenAI, chave
real, pergunta de cliente, VPS ou chamada paga.

## Limites e gates

- CI da HEAD exata deve validar Node, HTTP, Chromium/axe, Portal/Onepage,
  PHP/PG descartável, Comercial/SEO/build.
- Um reinício do processo não mantém esse latch: o saldo durável continua
  consumido, e o operador deve revisar falhas incertas antes de iniciar
  nova sessão. Sem autorização de publicação.
- Preservar `main`, site público, mascote, `publicFaiscaEnabled=false`.
  Sem merge/deploy/DNS, sem operação de CRM/Portal/Sites, cobrança,
  lead, ticket ou uso de dados reais.
- A homologação R92 e os testes pagos Luna/Terra já relatados não são
  repetidos. Instalação de R95+ em staging/VPS não comprovada nesta entrega.
