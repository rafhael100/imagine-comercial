# F155 — QA real de navegador sobre prévia autenticada F154

O teste Playwright cria um servidor de prévia Node em `127.0.0.1`, configura um navegador Chromium com **HTTP Basic sintético** e verifica acesso às telas efetivamente compiladas. Um contexto sem credenciais deve receber HTTP 401. O contexto autenticado verifica cabeçalhos de não indexação e não cache, homepage, menu móvel nativo, navegação até contato, briefing curado, cópia da mensagem por interação direta, confirmação acessível e limpeza de estado ao trocar opções. Qualquer erro JavaScript ou tráfego externo/POST falha o teste.

A etapa roda **depois da instalação do Chromium** na mesma CI de build e navegador. A senha é uma constante artificial local usada só no ambiente efêmero e não concede acesso a contas, dados ou serviços. O browser está preso ao servidor de loopback; não testa um endpoint público, TLS, MFA, RLS ou Leaseweb.

**Bloqueios não alterados:** F70 formulário e captura, receptor Portal/CRM real, LGPD, staging privado na VPS, GSC/crawl e revisões independentes; sem alteração de `main`, deploy, DNS ou serviços pagos.
