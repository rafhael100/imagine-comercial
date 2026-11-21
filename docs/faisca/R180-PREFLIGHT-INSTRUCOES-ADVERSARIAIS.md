# Faísca R180 — preflight contra instruções adversariais (somente laboratório)

## Escopo
- Novo classificador determinístico de instruções de substituição de regras, personificação de papéis e tentativa de revelação de prompts.
- Integrado ao limite HTTP autoritativo **antes** de `answerPrivateConversation` e de qualquer reserva/chamada ao provedor.
- A pergunta continua sendo apenas um exemplo fictício atestado pelo operador; nunca tratar esse classificador como DLP genérico, mitigação completa de prompt injection ou autorização para visitantes.
- A rejeição HTTP usa apenas `400 {"status":"invalid_question"}`, sem repetir o texto fornecido.

## Testes
`node --test tests/faisca-r180-private-instruction-override.test.mjs` valida casos de risco e casos neutros e executa o servidor HTTP 127.0.0.1 com um adapter em memória, sem OpenAI, sem dados reais e sem efeitos operacionais. Para cada caso adversarial, nenhuma chamada ao adapter é permitida.

## Gates
- Revisar `AGENTS.md` e CI da HEAD exata antes de integração.
- Testar novamente o navegador e a defesa redundante do preflight no front-end; o servidor é sempre autoritativo.
- A homologação R92 e o teste pago anterior pertencem ao operador e não foram repetidos.
- Revisão independente AppSec/LGPD/editorial e smoke R95 acumulado em staging privado ainda pendentes.
- **NO-GO público**: `publicFaiscaEnabled=false`. Não faz merge, deploy, alteração de VPS/DNS, operação CRM/Portal/Sites, lead, ticket ou cobrança.
