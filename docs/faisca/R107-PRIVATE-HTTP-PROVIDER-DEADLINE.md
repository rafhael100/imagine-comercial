# R107 — deadline HTTP e bloqueio conservador após resultado incerto

**DRAFT / laboratório privado.** Base R106 #581 (HEAD inicial `b71459b1633b375cd371e4821fae801a372c80d4`). Sem operação em VPS, credenciais, API paga, deploy ou merge.

## Falha reproduzível

R105 #580 delimita o tempo gasto no cliente `fetch`/stream Luna+Terra. Entretanto o adaptador injetado em `startFaiscaOpenAIPrivateReview` ainda podia devolver uma Promise que nunca resolvesse. A requisição HTTP ficava aberta indefinidamente, com `inFlight=true`. A proteção interna do cliente não deve ser a única barreira contra interfaces defeituosas ou integradores futuros.

## Correção

- `providerDeadlineMs` limitado a 50–30000 ms (padrão 30000 ms), menor que o timeout de 35 s do navegador privado.
- Deadline independente no handler HTTP antes de serializar a resposta, válido para casos fixos e perguntas fictícias livres.
- Após o deadline, resposta genérica 503 e `providerUnavailable=true` até encerramento/revisão manual do processo. Não permite segunda chamada ao provedor enquanto a anterior pode ainda estar em andamento/cobrar, mesmo que `inFlight` seja liberado.
- O Promise tardio não gera segunda resposta HTTP, retry, estorno ou novos efeitos.
- Estado de indisponibilidade apresentado somente no `inspect()` privado.
- Testes Node/HTTP verificam transporte injetado que nunca resolve, concorrência 429, fail-closed 503, resposta tardia e caminho normal sem bloqueio.

A proteção é **somente em memória por processo** e complementa o ledger durável R82–R100. Ela não interrompe obrigatoriamente uma chamada externa que ignore AbortSignal, não mede faturamento real, não substitui supervisão humana e não certifica produção.

## Gates

CI da HEAD exata, revisão independente AppSec/editorial/WCAG, staging pinado pelo operador, proteção de créditos e autorização operacional específica. A homologação R92 relatada não instala automaticamente R95–R107. Para público, identidade/grants Portal, proposta, contrato, aceite, recibo e GO continuam pendentes. `publicFaiscaEnabled=false`, mascote, site público e `main` permanecem intocados.
