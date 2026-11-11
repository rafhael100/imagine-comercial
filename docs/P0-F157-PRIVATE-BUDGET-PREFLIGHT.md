# P0 F157 — Pré-validação de orçamento em revisão privada

Componente executável `src/lib/private-budget-preflight.mjs` e testes Node. Reutiliza o catálogo real de seis serviços e a aproximação estrutural do mínimo CRM F3-06, sem duplicar a lógica de permissões.

**O que demonstra:** correspondência estrutural do formulário privado, opções válidas, requisito de ao menos um contato plausível, recusa de campos extras/getters/símbolos e diagnósticos fechados sem devolver nome, telefone, e-mail nem mensagem.

**O que não faz:** aceitar PII real, verificar consentimento ou base legal, autenticar empresa, validar antibot aritmético, abrir HTTP, guardar lead, gerar ACK de CRM, desbloquear F70 ou publicar formulário. `previewUnderstanding` não é consentimento legal. O resultado `STRUCTURAL_PREVIEW_ONLY_NO_AUTHORITY` é uma indicação de formato, nunca permissão para enviar.

O HTML público `src/pages/contato.astro` permanece **sem formulário/POST** e o formulário privado de revisão continua com botão desabilitado.

**Para verificar:** `node --test tests/private-budget-preflight.test.mjs` e `npm test`. Não executar com dados pessoais; os testes usam somente exemplos fictícios.

Próximo P0: ensaio independente de contrato formulário→serviço Portal→CRM com segurança e recibo durável em staging, sujeito aos gates F70, F94 e issue #56. Nenhuma alteração em `main`, DNS, Cloudflare ou produção.
