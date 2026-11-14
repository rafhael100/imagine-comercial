# F71 — Objetivo curado no Contato, sem formulário e sem persistência

A página `/contato/` passou a oferecer, além da escolha do serviço, um seletor opcional com quatro objetivos **públicos e previamente revisados**: novo projeto, melhorar site existente, planejar campanhas e receber orientação. Esses valores não constituem orçamento, diagnóstico, elegibilidade, perfil, formulário de lead ou compromisso de prazo.

A composição `composeCuratedContactLinks(serviceSlug,objectiveCode)` somente aceita identificadores presentes nos catálogos `services` e `contactObjectives`. O visitante decide quando clicar para abrir WhatsApp ou seu aplicativo de e-mail, já com texto/assunto contextualizados. Não há envio automático; o site não guarda preferências, parâmetros de objetivo, cookies, analytics nem informações pessoais. O fragmento `/contato/#slug` permanece restrito ao **serviço**, nunca inclui objetivo ou texto livre.

O acesso sem JavaScript conserva os CTAs padrão de WhatsApp e e-mail; o seletor apenas deixa de personalizar a mensagem. A interação em navegador verifica objetivos, alteração do serviço, proteção contra código desconhecido, valores curados, acessibilidade, ausência de requisições externas e os limites de 280/120 caracteres dos canais.

**Este recurso não resolve o gate `legacy-contact-intake-parity` da F70**: o formulário legado e o envio real de leads exigem integração Portal/CRM, consentimento, autenticação e homologação, ou fallback operacional expressamente aprovado antes de produção. Sem merge main, deploy, DNS, novos fornecedores ou dados de clientes.
