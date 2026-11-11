# F149 — Desconexão HTTP real após a transação em PostgreSQL descartável

## Objetivo

Complementar a F148, que simula `503` quando o resultado da transação é desconhecido, com um cenário no qual **não há sequer resposta HTTP válida**: o socket é encerrado depois que o PostgreSQL confirma a escrita de metadados sintéticos e a criação da outbox.

## Alterações

- A fixture privada F95/F96 ganhou um hook de teste `abortResponseAfterObservation`, aceito **somente** com adaptador `observeMetadata` injetado. Por padrão continua desabilitado e nunca é importado pelo Astro.
- Na suíte de integração PostgreSQL do runner hospedado, a terceira submissão com UUID sintético realiza a mesma instrução SQL transacional F96. Depois da operação de armazenamento, a fixture fecha deliberadamente o socket sem enviar resposta.
- O cliente precisa receber um erro de transporte (`TypeError`) em vez de um status HTTP 202.
- Consulta independente ao PostgreSQL confirma `1 ledger | 1 outbox` **antes** do reenvio.
- A tentativa seguinte observa `DUPLICATE_SYNTHETIC_METADATA`, sem segunda escrita; as contagens continuam `1|1`.
- Teste de Node puro reproduz a interrupção de socket com observador sintético e rejeita hooks sem adaptador obrigatório.

## Limites

**Não é falha real de rede, nem ambiente de produção:** apenas injeção controlada em `127.0.0.1`. O banco é novo e descartável no GitHub Actions, sem dados pessoais, credenciais externas, serviços pagos ou envio ao Portal/CRM. Mesmo que a segunda chamada receba 202/duplicata, todos os retornos possuem `crmPersisted:false`, `visitorAcknowledgementAllowed:false`, `deliveryProven:false`.

Isso não resolve reconciliação independente no destino, retenção, privacidade, autenticação real do serviço, antiabuso, rollback ou paridade F70. **Não autoriza abrir o formulário público, realizar deploy, DNS, redirects, merge `main` ou utilizar VPS persistente.**

## Validação requerida

`npm test`, Astro build, SEO/auditor, browser QA e `commercial-postgres-ephemeral-lab.yml` (com PostgreSQL de CI) devem permanecer verdes. A F149 integra a candidata RC31 **apenas após CI**.
