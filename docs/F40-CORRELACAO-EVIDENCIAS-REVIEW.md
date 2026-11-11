# F40 — Correlação independente das evidências de build e entrega (laboratório)

O F38 valida o pacote assinado offline contra um SHA-256 externo. O F39 verifica um recibo de witness Ed25519 também somente em laboratório. O F40 verifica que os resultados **já verificados** correspondem aos mesmos pins independentes: releaseId, staging/production e SHA-256 da árvore.

O relatório F40 jamais autoriza implantação. Rejeita evidências de outros releases, indicadores de deploy, schemas extras, pins incompletos, recibo não verificado ou divergência de árvore.

## Limitações
- Não verifica novamente assinaturas; os verificadores F38/F39 devem ser invocados primeiro, em processo confiável.
- Não prova entrega real: F39 usa witness sintético, sem servidor independente.
- Não substitui ledger durável, MFA, grants, LGPD, staging privado, revisão comercial/legal, verificação de bytes no destino, nem aprovação humana de deploy.
- Os objetos de resultado são entradas locais de laboratório: nunca aceitar JSON fornecido por cliente como se fosse prova criptográfica.
- Sem conexão remota, DNS, Cloudflare, merge main, gastos ou dados de clientes.

Teste local: `node --test tests/release-evidence-review.test.mjs`. Os testes integram o `npm test` padrão.
