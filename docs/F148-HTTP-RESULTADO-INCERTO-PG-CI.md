# F148 — Resposta HTTP incerta depois de commit PostgreSQL (CI descartável)

## Experimento integrado
- A mesma fixture HTTP local F95/F96 recebe duas submissões **sintéticas**, com organização e binding fixados.
- A primeira mantém a prova anterior de concorrência: duas requisições, 1 ledger e 1 outbox.
- Na segunda, o adaptador executa a reserva SQL de verdade numa base efêmera e **só então** simula a perda do resultado.
- O servidor responde HTTP 503 `LAB_METADATA_NOT_CONFIRMED`, com `crmPersisted:false` e `visitorAcknowledgementAllowed:false`.
- Uma nova tentativa observa uma duplicata, sem recriar ledger nem evento: contagem continua `1|1`.
- O teste rejeita apagar o evento silenciosamente, alegar que a mensagem chegou ao CRM, ou reconhecer um lead real.

## Ambiente e limites
O script só roda com os gates já existentes F51/F96: GitHub Actions, runner hospedado, banco PostgreSQL exclusivamente novo e descartável, conexão loopback. Não há PII, TLS operacional, OAuth, segredos permanentes, instalação na VPS ou comunicação externa. `main`, DNS e produção seguem intocados.

**Pendências:** reconciliação com registro CRM independente, transporte persistente de outbox, observabilidade, token de serviço real e homologação de staging com segurança e jurídico. Não resolve F70 nem autoriza coleta pública.

## Aceite
Executar `npm test` e workflow PostgreSQL descartável; este deve provar HTTP 503, 1+1 metadados antes e depois do replay, sem falso recibo de entrega.
