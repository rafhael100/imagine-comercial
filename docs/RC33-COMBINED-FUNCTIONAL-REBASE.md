# RC33 — Integração funcional rebase (DEV only)

A integração direta RC33 SEO → RC32 funcional encontrou divergências. Esta branch aplica só o delta da RC33 **sobre o código funcional mais recente**, preservando o CTA contextual F145 e o QA do menu móvel/clipboard F150–F151, além da prévia de homologação F154–F157.

Inclui filtros editoriais F152, sumário nativo F153, leituras relacionadas F154 e allowlist exata de mensagens externas F155. O contrato `tests/rc33-functional-integration.test.mjs` previne perda silenciosa dessas funcionalidades. O build conjunto precisa passar SEO/Chromium/PostgreSQL/Workerd antes de integrar.

Nenhum formulário público, API, 301, deploy, DNS, pagamento, dados pessoais, main ou custo ativado. Gates operacionais F70, Portal/CRM, LGPD, staging e SEG/DBA permanecem bloqueados.
