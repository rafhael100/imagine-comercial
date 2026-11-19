# Faísca R80 — perguntas comerciais fictícias digitadas pelo operador (IA real privada)

**Base:** R79 #552 (revisão privada, não publicada). Continuidade R72 (primeira chamada real Luna/Terra autorizada pelo usuário).

## Objetivo

Além dos três casos fixos da R72/R79, permitir ao operador testar uma pergunta **fictícia, sem dados de pessoas ou de clientes**, escrita no terminal privado. A pergunta nunca passa por um navegador público. O conteúdo é comparado com o catálogo editorial R06 antes de qualquer chamada à API. Uma segunda permissão explícita habilita essa funcionalidade **apenas no processo de teste**.

## Implementação

- `ops/faisca/openai/private-question-gate.mjs`: valida esquema estrito do operador, sem getters, escopo fixo `local_operator_lab`, atestado `attestedSynthetic: true`, limite de 240 caracteres/480 bytes, rejeição conservadora de contato, identificadores, segredos, conta/contrato/pagamento e texto de controle, fronteiras R09 e ausência de candidatos editoriais. Retorna uma referência de pergunta confiável, imutável e verificável por WeakSet, sem autorização operacional.
- `ops/faisca/openai/live-lab.mjs`: novo método `answerPreparedSyntheticQuestion` **desativado por padrão**. Quando `enableOperatorSyntheticQuestion: true`, somente aceita objeto criado pelo gate anterior, reutilizando as mesmas chamadas HTTPS, Luna e Terra, Structured Outputs, `store:false`, critérios de saída e limite de duas chamadas/US$0,01 da R72. Os três casos originais permanecem.
- `scripts/faisca-openai-private-operator-question.mjs`: CLI interativo, que não aceita perguntas como argumentos de shell, com duas variáveis opt-in separadas. Não publica chaves, headers ou erros completos. Apenas terminal privado do operador.
- `tests/faisca-r80-private-question-gate.test.mjs` e `tests/faisca-r80-operator-live-question.test.mjs`: entradas válidas e adversariais, objetos forjados, getter/Proxy hostil, ausência de envio quando bloqueado, sem identidade/CRM/checkout, single-flight, cotas e requisições estruturadas simuladas.

## Testes SEM custo na CI

```bash
node --test tests/faisca-r80-*.test.mjs
node --test tests/faisca-*.test.mjs
```

## Teste real somente com operador autorizado

No checkout isolado da branch R80 na VPS, após revisão da PR, com `OPENAI_API_KEY` injetada no ambiente privado e **sem dados reais**:

```bash
export IMAGINE_FAISCA_OPENAI_LIVE_TEST=YES_PAY_SYNTHETIC_ONLY
export IMAGINE_FAISCA_OPERATOR_QUESTION_TEST=YES_PRIVATE_FICTIONAL_ONLY
node scripts/faisca-openai-private-operator-question.mjs
unset IMAGINE_FAISCA_OPENAI_LIVE_TEST IMAGINE_FAISCA_OPERATOR_QUESTION_TEST OPENAI_API_KEY
```

Digite algo inteiramente fictício, como "Qual a diferença entre Onepage e Landing Page?". O CLI poderá fazer até duas requisições pagas, com os créditos da API do projeto Imagine. Não digite nomes, e-mails, telefones, identificadores de clientes, credenciais, pagamentos ou informações reais. O filtro lexical **não é DLP completo** e não substitui revisão humana.

## O que NÃO está pronto

Isto não é chatbot com texto livre para visitantes. O gate R80 não prova consentimento LGPD, segurança de dados reais, defesa contra toda injeção, fidelidade semântica absoluta ou uso comercial. A página R79 continua com três opções fechadas; o novo teste é somente no terminal privado. O orçamento em memória não é durável; produção requer controle persistente por empresa, autenticação, limite de gasto real, monitoramento, auditoria, integração Portal/CRM e homologação em staging.

**DRAFT/REVIEW ONLY**, sem merge, deploy, DNS/VPS, novas despesas automatizadas, alteração do mascote ou ativação de `publicFaiscaEnabled`.
