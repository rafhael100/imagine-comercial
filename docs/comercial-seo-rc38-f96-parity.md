# Comercial × SEO RC38 F96 — Revisão offline por SHA imutável

Este lote acrescenta um ensaio executável de integração entre o build da branch DEV do Comercial e a candidata RC38 do SEO Engine após F93–F96.

- SEO F92 de referência: `b60e75fbd3402410f4b5bf91b9d1ab4249e2271f`.
- SEO F96 testado: `329bbe34cb0fe67e599d02d6c28d0ce13ddeb475`.
- Os dois motores auditam **o mesmo `dist` gerado a partir do Comercial**, com `--strict-public-head --fail-on-warnings` e comparações exatas de erros/avisos/rotas.
- A suíte completa do motor candidato roda em Node 22.
- Um script adicional invoca de verdade o CLI F95/F96 com manifesto local e dois CSVs sintéticos: consulta pública para revisão, consulta Unicode pessoal para supressão integral das métricas e caminho `../` rejeitado, sem expor identificadores no resultado.
- A intenção do teste é gerar evidência de compatibilidade, **não trocar o pin oficial** do auditor no Comercial.

**DRAFT / NO-GO:** sem Search Console ou dados de clientes reais, OAuth, credenciais, AuthN/AuthZ, ingestão SaaS, deploy, DNS, redirects, checkout, indexação ou cobrança. Mesmo com CI verde, homologação, revisão AppSec/SEO/LGPD e autorização expressa seguem obrigatórias.
