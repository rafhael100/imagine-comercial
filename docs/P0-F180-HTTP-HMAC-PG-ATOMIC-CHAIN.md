# P0 F180 — HTTP real + prova HMAC + PostgreSQL atômico no mesmo CI

A F176 definiu nonce e HMAC com duração curta; a F177 passou a exigir a prova no receptor privado; a F178 acrescentou Chromium real; e a F179 comprovou reserva única em PostgreSQL descartável. A **F180 une o HTTP e o banco no mesmo teste integrado**, eliminando a lacuna entre os dois laboratórios.

## Implementação

`startPrivateBudgetReviewLab` aceita opcionalmente `claimNonce`, somente quando `requireRequestProof:true`. O valor padrão continua sendo reserva em memória e preserva a suíte existente. Quando fornecido pelo laboratório de PostgreSQL, o callback recebe apenas um nonce base64url validado e a expiração, e executa `INSERT ... ON CONFLICT DO NOTHING RETURNING nonce` em transação real do banco descartável. O receptor HTTP nega tokens repetidos antes de executar qualquer validação de CRM.

Um limite de **256 provas emitidas** por instância de laboratório também evita emissão ilimitada enquanto não há claims. O servidor continua escutando somente `127.0.0.1` e exige Basic Auth de teste, Origin exata, Host exato e JSON bounded. Esse limite **não** demonstra rate-limit de produção.

A CI GitHub-hosted F51/F96/F179 cria schema novo `imagine_budget_proof_http_ci` exclusivamente no banco `imagine_comercial_ci`. O teste envia oito POST HTTP concorrentes usando o **mesmo token** e confirma 1 diagnóstico estrutural e 7 negativas 409, além de apenas uma reserva SQL. Um POST de origem atacante não consome um segundo token, que pode ser utilizado corretamente depois. Não há contato, mensagem, senha ou token nas respostas; o diagnóstico estrutural válido ainda retorna **`ATOMIC_STORE_REQUIRED` sem recibo CRM**.

## Limites

A tabela e o callback existem **somente em laboratório**, não em migrations de runtime. O teste usa o usuário PostgreSQL do runner descartável e não demonstra menor privilégio, RLS/tenant final, consentimento, antifraude/bot, chave de assinatura gerenciada, alta disponibilidade, retenção, rollback ou revisão AppSec/DBA. Não altera Portal/CRM produtivo, Site atual, VPS, `main`, DNS nem faz deployment. F70 permanece **NO-GO** para captação pública.
