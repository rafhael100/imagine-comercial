# Faísca R133 — preflight Unicode do servidor privado

## Motivação
A proteção R131 atua no navegador privado e a R132 demonstra o comportamento com Chromium, mas um operador ou adaptador pode enviar uma requisição HTTP diretamente, sem executar o JavaScript. A regra de entrada em `private-question-gate.mjs` ainda só barrava intervalos específicos de caracteres invisíveis, permitindo soft hyphen, BOM, isolates e combining grapheme joiner em texto aceito.

## Implementação
O gate autoritativo `readPrivateSyntheticQuestion`, empregado no HTTP loopback **antes de `lab.answerPrivateConversation`**, passa a rejeitar a classe Unicode `Default_Ignorable_Code_Point`. O servidor não normaliza silenciosamente o texto e não usa a validação do navegador como autorização.

Prova executável: `tests/faisca-r133-http-private-unicode-preflight.test.mjs` executa verificação direta e requisições HTTP autenticadas reais em 127.0.0.1 com cinco caracteres invisíveis. Exige HTTP 400 `invalid_question`, zero chamadas ao provedor sintético e sucesso de um controle positivo com pergunta fictícia limpa. Nenhuma chave API ou chamada paga é utilizada.

## Validar
```bash
node --test tests/faisca-r133-http-private-unicode-preflight.test.mjs
node ops/faisca/openai/private-conversation-browser-qa.mjs
npm test
```
A CI acumulada inclui Chromium/axe, HTTP, Node, revisão de build/SEO e compatibilidades sintéticas. Ainda requer revisão AppSec/editorial independente e homologação de staging privada, nunca presumindo R95+ instalado na VPS. R92 já foi homologada por relato do operador.

Dependências: R132 #607, HEAD `07c91f2bcd65e89388034980fad46294933b32c4`, que inclui R131 #606 e R130 #605. `main`, site público, PNG aprovado e `publicFaiscaEnabled=false` intactos. Sem merge/deploy/VPS/DNS, dados pessoais reais, credenciais, OpenAI paga, CRM/Portal operacional, leads, tickets ou cobranças. **NO-GO público**.
