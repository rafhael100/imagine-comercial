# F158 — Política única e exata de links externos (HTML compilado + navegador)

Antes desta entrega, o auditor de links no HTML compilado e o auditor dos links observados pelo Chromium usavam critérios diferentes. Um aceitava somente mensagens públicas predefinidas, enquanto o outro aceitava texto aparentemente legítimo com prefixo "Olá" ou "Contato Imagine", possibilitando aprovar links montados com conteúdo externo arbitrário.

## Implementação

O contrato `outbound-link-contract.mjs` passa a exportar a função estrita `isApprovedPublicExternalHref`, que aceita somente links exatos gerados a partir dos catálogos públicos. A whitelist inclui todos os **560 estados combinatórios do briefing F142** (serviços, objetivos, momento e prioridade), além dos canais fixos já aprovados. Não inclui texto livre, codificações alternativas, destinatários diferentes, rastreamento, BCC ou query arbitrária.

O revisor `public-link-review.mjs` usa **a mesma função** para URLs externas capturadas no DOM, mantendo uma garantia adicional: o login do Portal só é autorizado quando a URL exata está configurada e aprovada no build. A whitelist isolada não libera login não configurado.

Os testes Node incluem as 560 combinações legítimas e URLs forjadas com pretexto de suporte, pagamento ou solicitação de dados. A CI executa também browser QA, auditoria do HTML compilado, testes SEO e laboratório PostgreSQL existente.

**Sem captação pública, credenciais, rede, Analytics, dados reais, aprovação de DNS/301 ou publicação.** A inspeção de links não comprova que um canal externo está disponível; os canais comerciais devem ser reconfirmados antes de substituir o site antigo.
