# F78 — Compatibilidade documental Comercial ↔ CRM F3-11 (somente laboratório)

## Fonte efetivamente inspecionada
Contrato em PHP puro do repositório `rafhael100/imagine-crm`, branch `dev/f3-12-idempotency-cas-lab-2026-11-08`, arquivo `app/Core/Leads/SyntheticLeadEnvelopeV1Inspector.php`, com explicação em `docs/desenvolvimento/F3-11-envelope-v1-sintetico-leads-2026-11-08.md`.

A estrutura é uma **proposta de envelope técnico sintético**, não API validada, especificação final de tráfego HTTP, identidade autenticada ou autorização de tratamento de dados.

## O que foi alinhado
`src/lib/crm-envelope-v1-compat-lab.mjs` aceita exatamente oito campos, sem nenhum contato ou conteúdo: `protocol` = `imagine.lead-intake`, `schema_version` = número inteiro 1, e seis referências UUID declaradas (`organization_reference`, `binding_reference`, `submission_reference`, `site_reference`, `form_reference`, `destination_reference`). Recusa UUID nulo, chaves extras e ausentes. A avaliação devolve **somente** um dos cinco códigos de estrutura do CRM: `STRUCTURE_ONLY_UNVERIFIED`, `ENVELOPE_STRUCTURE_INVALID`, `PROTOCOL_UNSUPPORTED`, `VERSION_UNSUPPORTED`, `REFERENCE_FORMAT_INVALID`.

Todas as capacidades de envio, confirmação durável e entrega ao CRM permanecem `false`, mesmo quando a estrutura passa. Retorno não inclui IDs ou dados pessoais. Os testes cobrem a matriz negativa e ausência de qualquer chamada a rede.

## Diferenças e decisões pendentes
O Comercial F30 valida um rascunho mínimo para futura conversa e atualmente exige e-mail; o CRM F3-06 inspeciona sinteticamente nome e ao menos um canal de contato (e-mail ou telefone). **Não são o mesmo contrato**: um é rascunho editorial, outro é proposta de regras de mínimo para determinado canal.

O Comercial F77 simula segregação por tenant com nomes fictícios. O CRM F3-11 usa `organization_reference` UUID alegado e F3-12 propõe chave de idempotência organização + submissão. A F78 não converte nomes fictícios em UUID reais nem autentica vínculos; exige definição conjunta de tenant, site, formulário e destino pelo backend do Portal.

Não liberar integração até revisão de Produto, LGPD, Segurança, operação e testes com APIs reais em staging. Permanecem pendentes: privacidade e consentimento real, grants e tenant autenticado, vínculo site/formulário/destino validado, endpoint HTTPS, fila/outbox, idempotência persistente, recibo de entrega, antispam, retenção e fallback operacional F70.

Sem alteração em `main`, DNS, envio real, credenciais, clientes, infraestrutura ou despesas.
