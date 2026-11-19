# F64 — Como funciona um projeto (guia de briefing público)

A rota `/como-funciona/` apresenta, com HTML estático, seis pontos para a conversa comercial: objetivo, formato, proposta, materiais/aprovações, execução/revisão e continuidade quando aplicável. Inclui seis perguntas de briefing úteis para o visitante e links locais para a comparação de serviços, o catálogo e o contato.

## Limites editoriais
- As etapas são **ilustrativas**, não uma oferta ou um fluxo obrigatório de todos os produtos. Quantidade de revisões, valores, prazos, contratos, cancelamento e suporte são definidos somente pela proposta vigente.
- O conteúdo não promete aprovação automática, a ativação do Portal, resultados de anúncios/SEO, velocidade fixa nem publicação sem autorização.
- O aviso desestimula compartilhamento de senhas, documentos pessoais e acessos por canais não homologados. O site não possui campo de dados, cookies, armazenamento, scripts clientes ou envio de briefing.

## QA
- A página usa `sitePages` para integrar canonical, sitemap, verificações de HTML e auditor SEO fixa.
- Testes Node validam as seis etapas, perguntas e ausência de valores inventados/transporte/PII.
- QA Playwright percorre a rota em viewport 375 e 1440 px, mede overflow, roda axe-core WCAG 2.1 A/AA, verifica seis cartões e a lista de perguntas e testa a navegação para a âncora interna.
- Homepage, footer e Contato apontam para o guia, mantendo alternativas de navegação sem JavaScript.

Revisar conteúdo e identidade em homologação com responsáveis antes de qualquer lançamento. VPS, Portal, CRM, consentimento, GSC e redirects continuam bloqueados conforme issues #56, #4 e #3. Sem main, deploy, DNS, dados de clientes nem despesas novas.
