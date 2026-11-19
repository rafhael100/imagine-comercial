# P0 F178 — Navegador real, prova assinada e contrato CRM no HTTP local

Esta entrega reúne as F162, F176 e F177 em **um único ensaio Chromium real**, em mobile (375 px) e desktop (1440 px). A prévia privada original de sete campos continua com o botão de envio **desativado**. O runner de testes preenche informações inteiramente fictícias, extrai os nove valores estruturais e testa o fluxo no servidor HTTP efêmero em `127.0.0.1` que requer `requireRequestProof:true`.

A sequência comprova a defesa antes da revisão: GET de token exige Basic Auth, token HMAC/nonce tem validade de 120 s, POST sem token é negado (422), POST com token válido alcança apenas a revisão estrutural e devolve **`ATOMIC_STORE_REQUIRED`**, e repetição do token é negada (409). Respostas não contêm contato, identificação sintética, senha ou token; cabeçalhos no-store/noindex e ausência de cookies são verificados. A página privada não cria envio automático, não acessa terceiro e mantém `submit` desabilitado.

A CI de navegador agora executa `scripts/test-private-budget-proof-browser-ci.mjs` após o teste existente F162, sem dispensar qualquer verificação de contratos, SEO, WCAG ou PostgreSQL. Uma falha no fluxo torna o workflow vermelho.

**Ainda faltam para F70 operacional:** consentimento/aviso LGPD, defesa antirrobô efetiva (HMAC não substitui), autenticação e vínculo empresarial do Portal, armazenamento distribuído de nonce com atomicidade, endpoint HTTPS real, persistência/outbox/ACK no CRM, testes de acessibilidade do formulário final, revisão de segurança independente e aprovação formal do lançamento. Sem `main`, DNS, deploy, dados reais ou custos adicionais.
