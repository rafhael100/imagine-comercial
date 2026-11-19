# Faísca R49 — protocolo de bytes mínimo para futura classificação externa

**Base:** [Faísca R48 #512](https://github.com/rafhael100/imagine-comercial/pull/512). **Escopo:** contrato determinístico inteiramente local; nenhum modelo externo, rede, pagamento ou dado real.

## Lacuna corrigida

R47/R48 estabeleceram o envelope mínimo e o adaptador em que um classificador recebe apenas IDs editoriais fechados. Ainda faltava definir **quais bytes uma eventual integração de transporte poderia serializar**, e garantir que código posterior não enviasse acidentalmente a requisição interna R09, que contém texto de usuário e identificadores de sessão.

## Implementação

- `ops/faisca/model-router/contract.mjs`: cada envelope R47 é marcado internamente como **emitido por requisição confiável do host**, em `WeakSet`. Clones, envelopes reconstituídos por JSON, proxies e objetos externos não recebem essa marcação.
- `ops/faisca/model-router/candidate-wire.mjs`:
  - `serializeCandidateOnlyWireRequest(envelope)` aceita **somente** envelopes host-trusted. Ele emite JSON determinístico com `schema`, tarefa fixa, `locale`, versão do catálogo, lista de no máximo cinco IDs editoriais, IDs de esclarecimento fixos e limites de saída. Nunca envia `userText`, `messageId`, `conversationId`, `invocationId`, fontes extensas, URL, empresa, visitante, credencial, preço, lead, contrato ou ferramenta;
  - tamanho máximo de **1.024 bytes UTF-8**; devolve apenas conteúdo e medição, sem chamada HTTP;
  - `parseCandidateOnlyWireDecision` limita a resposta a **256 bytes** e aplica o mesmo validador fechado R48. Só retorna um ID de resposta permitida ou um ID de esclarecimento permitido, sem texto livre, URL, ferramenta, transação ou comando operacional.
- `tests/faisca-r49-closed-wire.test.mjs` cobre tamanho/serialização, valores não autorizados, proxies, clones, saídas com preço/tools, IDs inventados, resposta malformada, replay e retorno R09 verificado. Tudo é simulado e local.

## Fronteira de confiança

Os hashes do catálogo e listas de candidatos **não são dados pessoais identificáveis por si**, mas podem revelar interesses comerciais do visitante; portanto, **esta PR não autoriza transmissão desses IDs a fornecedores**. O envelope reduz drasticamente o risco de enviar PII por acidente, não fornece anonimização formal, nem resolve as exigências LGPD, política de retenção, DPA, residência dos dados ou cookies de um provedor real.

O runtime R09 continua recusando qualquer `provider.kind` diferente de `simulated`. O protocolo não cria `fetch`, cliente HTTP, autenticação, URL de destino, credencial de API, conta paga, cobrança ou telemetria.

Antes de ligar um provedor real: escolher fornecedor/modelo/região, obter análise jurídica, isolar processo e egress, manter credenciais em vault, orçamento e rate limit duráveis, trilha auditável sem conversas, testes adversariais PT/EN/ES e obter GO operacional específico.

**A CI deve ser conferida na SHA exata da R49. Sem merge na main, VPS, DNS, custos, dados reais, CRM/Portal operacional, PSP, checkout ou alteração da identidade visual/mascote aprovado.**
