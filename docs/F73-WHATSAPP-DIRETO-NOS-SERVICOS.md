# F73 — Canal direto de WhatsApp em cada serviço, sem JavaScript

As seis páginas públicas individuais de serviço agora contêm, além da jornada interna `/contato/#slug`, um link direto de WhatsApp que já prepara o **nome público e revisado do serviço**. O link é construído no build Astro por `composeCuratedContactLinks(s.slug)` e `contactWhatsAppUrl()`, usando o mesmo destino externo de contato que já integra o allowlist F32/F36.

O atalho funciona mesmo com JavaScript desativado: é um elemento `<a>` comum, com `target=_blank`, `rel=noopener noreferrer` e `aria-describedby` apontando a um aviso visível de que o canal é externo, a mensagem é apenas preparada e o envio depende do visitante. A página não recebe nem persiste informações, não cria formulário, login, cookie ou requisição ao CRM.

Os testes Node e QA Chromium inspecionam as seis mensagens curadas, texto/assunto, links no HTML gerado, relação com o aviso, fallback sem JavaScript e proibição de requisições externas espontâneas. O atalho **não substitui a necessidade de paridade operacional do formulário antigo** nem prova que o número informado no site antigo continua ativo; a reconfirmação do canal e aprovação de fallback são responsabilidades do gate F70 antes de qualquer publicação.

Sem deploy, DNS, mudança em `main`, credenciais, dados reais de visitantes ou fornecedores adicionais.
