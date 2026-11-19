# Faísca R81 — testes de IA real sem o limite experimental de US$ 0,01

**Base:** R80 PR #553, SHA `dcacdf0b008c06c75c22e6421e895a90b753ffea`. Trabalho de laboratório privado, sem publicação.

## Motivo

O usuário confirmou que os créditos OpenAI estão disponíveis para custear a fase de desenvolvimento. O limite experimental R72/R80 de **uma pergunta e duas chamadas por processo** exigia reconfigurar o terminal para cada resposta. A R81 permite vários testes reais na mesma sessão, sem interromper o fluxo após uma pergunta.

## Entrega técnica

- `ops/faisca/openai/live-lab.mjs`: modo **`extendedPrivateSession: true`**, explicitamente habilitado somente pelo operador. Aceita `maxRequests` até 100 chamadas e orçamento estimado até US$ 10 **por processo**. Os valores antigos seguem intactos por padrão: duas chamadas e US$ 0,01 por sessão, para preservar compatibilidade. Não há repetição automática, concorrência paralela nem ferramentas operacionais.
- `scripts/faisca-openai-private-operator-question.mjs`: CLI interativo com até **50 perguntas fictícias** na mesma sessão, usando **GPT-6 Luna + GPT-6.1 Terra** e uma única configuração privada de credenciais; o operador encerra com `sair`. O código permite até 100 chamadas e reserva US$ 10. Um retorno do seletor `none` pode consumir só uma chamada. Texto pessoal/contratual/financeiro continua bloqueado pelo gate R80.
- `scripts/faisca-openai-private-review-server.mjs`: a página privada R79 por túnel SSH agora também admite até 50 respostas por sessão, sem reiniciar o processo a cada resposta. Não abre portas públicas e não altera `src/` nem `public/`.
- `tests/faisca-r81-extended-paid-session.test.mjs`: testes de múltiplas perguntas, custo estimado reservado, recusa antes da rede, limites de requisição e preservação das proteções de dados. Testes usam transporte simulado e não gastam créditos.

## Na VPS: uso autorizado de créditos para perguntas fictícias

A partir de checkout isolado R81, usando Node 22+ e chave já injetada de forma privada:

```bash
export IMAGINE_FAISCA_OPENAI_LIVE_TEST=YES_PAY_SYNTHETIC_ONLY
export IMAGINE_FAISCA_OPERATOR_QUESTION_TEST=YES_PRIVATE_FICTIONAL_ONLY
node scripts/faisca-openai-private-operator-question.mjs
```

Digite perguntas fictícias sobre serviços, ex.: `Qual a diferença entre um site Onepage e uma Landing Page?`. Digite `sair` para encerrar. Não coloque dados reais de pessoas ou clientes, telefone, e-mail, pagamentos ou credenciais.

## Controles e distinções importantes

**O saldo promocional não substitui governança de custos:** a reserva estimada do processo não prova cobrança final; use o painel Usage/Billing da API para conferir o valor real e mantenha alertas do projeto. Após fechamento de cada processo, as cotas locais são reiniciadas. Elas **não são duráveis entre workers**, não se tornam hard stop de fatura e não autorizam chamadas automáticas em segundo plano. Nenhuma chave é incluída no GitHub, nem há uso pago em GitHub Actions.

A R81 não habilita chatbot público com mensagens livres, CRM, Portal, contratos, pedidos, pagamento ou acesso de terceiros. O mascote aprovado permanece inalterado; `publicFaiscaEnabled=false`. Revisão independente AppSec/LGPD/editorial, ensaios privados e GO operacional seguem necessários.

## Validação sem gasto

```bash
node --test tests/faisca-r81-extended-paid-session.test.mjs tests/faisca-r80-operator-live-question.test.mjs tests/faisca-r72-openai-live-lab.test.mjs
node --test tests/faisca-*.test.mjs
```
