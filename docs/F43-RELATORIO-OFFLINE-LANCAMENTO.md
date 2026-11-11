# F43 — Relatório offline dos bloqueios do lançamento

A CLI `node scripts/report-launch-blockers.mjs` retorna JSON determinístico com os nove gates F42, todos pendentes por padrão. Para preparar a revisão de staging, executar `node scripts/report-launch-blockers.mjs --target=staging`.

- Sem rede, arquivos de entrada, acesso ao GitHub, domínio, API, secrets ou clientes.
- Nenhum parâmetro pode marcar um gate como concluído.
- O relatório somente demonstra os **gates de política presentes no código**, não mede a situação real da VPS/Portal/CRM.
- A resposta sempre inclui `approval: NOT_AUTHORIZED` e `deploymentPerformed: false`.
- Usar a lista para coletar evidências privadamente e revisar com operadores responsáveis. A liberação real requer confirmação independente, incluindo proprietario, sem automatizar DNS/merge/deploy.

O build e o site em produção não são alterados.
