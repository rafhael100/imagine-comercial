# F50 — Exercitar adaptador PostgreSQL no E2E Astro protegido

O teste integrado real de build Astro (`scripts/test-build-catalog.mjs`) agora usa o **código efetivo** do adaptador PostgreSQL F49, não o ledger auxiliar em memória F41. Um objeto de transporte `query` simula somente as respostas SQL e a unicidade; os demais passos exercem catálogo público assinado, verificador de bytes F38, política assinada do witness F45 e comparação de pins F40.

Testes incluídos: nenhuma escrita de nonce antes de validar artefato e recibo; primeira reserva aceita, replay rejeitado, segunda instância do adaptador reconhece replay e indisponibilidade do banco falha fechada.

A simulação do driver **não é** um teste de PostgreSQL real. O gate de banco durável continua no [issue #56](https://github.com/rafhael100/imagine-comercial/issues/56) até rodar migração e validação em staging privado, com ledger transacional e permissões mínimas. Nenhum deploy, DNS, credenciais, cliente real ou despesa é incluído.
