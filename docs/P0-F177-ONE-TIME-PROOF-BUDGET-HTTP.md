# P0 F177 — Receptor HTTP privado de orçamento exige prova assinada de uso único

## Avanço efetivo na cadeia F70

A F176 implementou emissão e verificação de um token HMAC/nonce efêmero. A F177 conecta esse verificador ao receptor HTTP já existente do orçamento privado (F161/F162) por **opção opt-in apenas de laboratório**: `startPrivateBudgetReviewLab(password,{requireRequestProof:true})`.

Nesse modo, o servidor disponibiliza `GET /__lab/budget/request-proof`, somente autenticado em loopback, e exige `requestProof` assinado junto aos quatro campos estruturais de diagnóstico do orçamento enviado ao POST `/__lab/budget/structural-review`. A prova é validada por origem, escopo de sessão, HMAC, expiração e nonce reservado uma única vez. Sem ela, o POST retorna 422/409 e **não** executa a revisão CRM. Repetição, falsificação e concorrência falham fechadas. Um pedido estruturalmente válido continua retornando **apenas** `ATOMIC_STORE_REQUIRED` e `canAcknowledgeVisitor=false`, nunca confirmação de captação.

A opção padrão `requireRequestProof:false` conserva integralmente os testes e contratos antigos F161/F162. Não existe rota pública, anti-bot de produção, consentimento comprovado nem CRM ativo. O consumo de nonce usa Set em memória somente na instância de teste; não é proteção distribuída/durável. O navegador público permanece sem formulário e o botão da prévia continua desativado.

## Testes

Node exercita fluxo de emissão→POST→negação de replay e 12 POST concorrentes, Origin inválido, token alterado, campo extra contendo suposto contato, corpo malformado, ausência de prova, resposta sem cookies e contagem exata de confirmação **zero**. As provas criptográficas F176 (TTL, MAC, nonce, sessão) já são cobertas em separado. O CI executa os dois laboratórios sem credenciais reais.

**Pendências reais:** autenticação de serviço e tenant no Portal, CSRF/sessão operacional, anti-abuso/bot de servidor, armazenamento de nonce durável, consentimento LGPD, persistência/outbox e ACK do CRM, acessibilidade/copy jurídico e homologação independente na Leaseweb. Sem merge `main`, DNS, deploy ou acesso real.
