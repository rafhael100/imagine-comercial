# Faísca R48 — fronteira efetiva entre roteador e classificador de respostas

**Base:** Faísca R47 [#511](https://github.com/rafhael100/imagine-comercial/pull/511). **Escopo:** simulação local, sem ativar LLM externa, sem enviar dados, sem custo, sem serviço operacional.

## Lacuna resolvida

A R47 criou um envelope mínimo de classificação, sem texto do visitante ou identificadores de conversa, mas a interface clássica do runtime R09 ainda entrega o objeto interno completo ao `provider.route(request)`. Se um implementador futuro colocasse seu cliente de IA diretamente ali, ele poderia transmitir o texto livre e as passagens completas por engano.

A R48 implementa a fronteira de encaminhamento: o **host** recebe a requisição R09 completa, valida-a e constrói o envelope R47; o **seletor fornecido** recebe exclusivamente esse envelope reduzido. O host, não o classificador, reanexa a correlação da requisição após validar rigorosamente o identificador selecionado.

## Entrega

- `ops/faisca/model-router/decision-bridge.mjs`:
  - `createCandidateOnlyDecisionBridge({decide})` retorna um provedor **`kind=simulated`** aceito pelo runtime R09; o callback `decide` recebe somente o objeto imutável `faisca.model-route.candidate-only-egress.v1`, nunca `userText`, `conversationId`, `messageId`, `invocationId`, dados de clientes ou URLs;
  - `validateCandidateOnlyDecision` aceita exclusivamente a decisão `faisca.candidate-only-decision.v1` com os campos `schema`, `mode`, `answerId` e `clarificationId`. O `answerId` precisa pertencer aos candidatos selecionados pelo host; a clarificação deve estar na lista fechada de opções; todo campo extra, texto gerado, ferramenta, URL, getter, ID estranho ou propriedade inesperada é recusado;
  - a seleção verificada é convertida novamente para o contrato de resposta R09, com `messageId` e `invocationId` reanexados **somente no host**. O runtime R09 verifica outra vez a resposta e o R06 é responsável pelo texto editorial e pelas fontes;
  - um simulador local determinístico permite testar o contrato tanto em modo `answer` quanto `clarify`, sem modelo de linguagem.

- `tests/faisca-r48-closed-decision-bridge.test.mjs`: regressões de privacidade do callback, rejeição de texto/preço/ferramentas/IDs injetados, getters hostis, recusa de perguntas de suporte/PII, idempotência, timeout/reconciliação e fundamentação editorial R06 com `externalModelInvocations=0`.

## Fronteiras e limitações

**Não é sandbox de JavaScript:** código de terceiros executado dentro do mesmo processo pode observar dados por outros meios; uma implementação externa futura deverá receber **somente o envelope serializado** em processo isolado/servidor, com outbound allowlist, proteção de segredos, auditoria, quotas distribuídas e revisão AppSec.

A presença de um envelope mínimo não autoriza enviar dados a qualquer fornecedor. Antes de ativar IA real, definir provedor, modelo, orçamento, região, DPA/LGPD, retenção e consentimento/aviso aplicáveis, controle por tenant, budgets duráveis, telemetria sem transcrição, avaliação PT/EN/ES, estratégia de indisponibilidade e aprovação separada.

## Validação

A SHA exata da PR R48 deve passar pelos workflows GitHub (Faísca, PHP fixado, PostgreSQL descartável, Comercial SEO/navegador e compatibilidade Portal). Todos os testes utilizam dados sintéticos, não acessam redes externas nem alteram a VPS.

**Nada publicado:** sem alteração do mascote, páginas públicas, DNS, `main`, custos, credenciais, clientes reais, CRM, Portal operacional, PSP, checkout ou conexão de IA paga.
