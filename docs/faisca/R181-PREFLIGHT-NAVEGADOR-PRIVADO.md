# R181 — preflight do navegador para mensagens fictícias adversariais

O browser privado agora recusa instruções explícitas para ignorar regras,
personificar papéis de sistema/desenvolvedor/administrador ou revelar prompts
antes de construir um POST. Limpa imediatamente o campo da pergunta, a
atestaçao fictícia e o token temporário, sem armazenamento.

O servidor R180 continua com validação **independente e autoritativa**.
O teste Chromium real em
`ops/faisca/openai/private-conversation-browser-qa.mjs` intercepta
qualquer POST de conversa, exige **zero** requisições emitidas nos cenários
adversariais, zero chamadas ao adapter e limpeza dos três campos.

Este filtro lexical não garante detecção de todo prompt injection e não
autoriza uso com dados reais, clientes ou visitantes. A interface e o
mascote permanecem privados; `publicFaiscaEnabled=false`.

Para a HEAD da PR, exigir CI completa Node/HTTP/Chromium/axe, revisão
editorial/AppSec/LGPD e homologação acumulada no staging privado por operador.
Não acessar chave OpenAI, não repetir homologação R92, não supor instalação R95.
Sem merge, deploy, DNS, VPS, CRM, Portal, Sites, leads, cobrança ou tickets.
