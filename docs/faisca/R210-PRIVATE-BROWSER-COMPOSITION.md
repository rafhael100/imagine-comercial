# Faísca R210 — composição seletiva de controles HTTP e privacidade do navegador

**Base exata:** R209 #687 HEAD inicial `029072dd9a5d869ad576b3e590cba9e2fd2196cc`. R209 é uma correção dos fixtures legados da R207 #685, que introduziu validação estrita de URL/redirect e `Content-Type: application/json` em HTTP 200. A R208 #686 é paralela, baseada em R206 #684, para recusar nomes de domínio, IPs/contatos numéricos e formatos de segredo no último limite de apresentação.

## Composição sem sobrescrever branches

- Incorporado **somente** `privateBrowserPiiRisk` reforçado da R208 dentro de `ops/faisca/openai/private-review-page.mjs`, mantendo a validação autoritativa R207 de status 200, URL final exata, ausência de redirect e MIME JSON UTF-8.
- O script privado foi mantido **abaixo do limite preexistente de 24 KiB**, removendo exclusivamente comentários redundantes, sem elevar limites nem relaxar verificações.
- Preservados testes R207 de MIME/URL e integrados os cenários Chromium R208, que interceptam respostas HTTP 200 fictícias e verificam rejeição de identificadores, nenhuma requisição paga, campos limpos e orientação segura aceita.
- Incorporados os testes HTTP Node de R208 e os 11 ajustes de fixtures de R209, sem alterar arquivos dos PRs de origem.
- Todo o conteúdo continua apenas em laboratório privado. Não importa alterações de Portal/Sites nem habilita funcionalidades públicas.

## Gates de validação

- [ ] CI integral na HEAD exata R210 (Node/HTTP, Chromium/axe/WCAG, PHP, PostgreSQL descartável, Onepage/Portal e Comercial/SEO/build).
- [ ] Revisões independentes AppSec/LGPD/FinOps/editorial da composição.
- [ ] Homologação acumulada da conversa fictícia R95–R210 em staging privado com evidência operacional, conciliação de custos e confirmação explícita antes de qualquer operação pública.

Os testes pagos Luna/Terra e a homologação R92 previamente relatados não foram repetidos. Não houve acesso a chaves, VPS, dados reais nem chamadas pagas nesta entrega.

**NO-GO público:** manter `publicFaiscaEnabled=false`, `main`, site público e mascote aprovado intactos. Não realizar merge, deploy, DNS, publicar ou fazer ações CRM/Portal/Sites, cobranças, leads ou tickets.
