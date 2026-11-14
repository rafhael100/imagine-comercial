# Comercial SEO-F155 — Texto exato aprovado nos canais externos

A auditoria F149 já limitava os links externos a WhatsApp, e-mail, telefone e login oficial do Portal. A F155 corrige uma lacuna: aceitar um texto de WhatsApp que apenas começasse por `Olá,` e contivesse `Imagine` não era prova de que o texto integrava a lista de mensagens comerciais aprovadas.

O novo verificador constrói um conjunto fechado de URLs a partir dos **seis serviços**, **quatro objetivos opcionais** e casos sem seleção: 35 combinações de mensagem e assunto. Só os URLs exatos produzidos por `composeCuratedContactLinks`, `contactWhatsAppUrl` e `contactEmailUrl` podem aparecer no HTML gerado, além dos canais públicos sem mensagem e do login oficial previamente validado. Valores arbitrários, domínios parecidos, parâmetros adicionais e codificações alternativas são recusados.

Essa proteção ocorre no build e não envia mensagens, não coleta nomes/telefones e não faz requisições. A alteração preserva o comportamento do seletor já testado com Playwright e o modo sem JavaScript. A confirmação de números e endereço eletrônico reais antes do deploy continua obrigatória.

**HOLD:** revisão de segurança e publicação pendentes; sem mudança de DNS, redirects, merge `main`, deploy, dados de clientes em CI ou custos novos.
