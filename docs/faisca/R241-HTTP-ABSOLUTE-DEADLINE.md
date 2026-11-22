# Faísca R241 — prazo absoluto de resposta HTTP privada (REVIEW ONLY)

## Problema reproduzível

A sonda sem credenciais R240 exige HTTP 401, headers de autenticação/CSP e corpo limitado, mas seu `req.setTimeout(2500)` mede *inatividade* do socket. Um servidor que envie um byte a cada 75 ms mantém a conexão ativa indefinidamente, sem concluir as cinco verificações. A leitura de cabeçalhos também dependia apenas do limite padrão do Node.

## Alteração proposta

- Cada uma das cinco requisições GET/HEAD fixas a **127.0.0.1** passa a ter sinal de cancelamento **absoluto de 2500 ms**, não configurável pelo solicitante.
- Leitura de cabeçalhos HTTP limitada a **8192 bytes** por resposta, independentemente do limite implícito do runtime.
- O timeout de inatividade é mantido como defesa adicional; abortos, falhas de parsing e oversize retornam somente a mensagem HOLD genérica (sem conteúdo da resposta).
- `tests/faisca-r241-loopback-absolute-deadline.test.mjs` exercita 401 sintético com fluxo contínuo de bytes e resposta com cabeçalho >12 KiB. O caso legítimo R240 continua exercitado pela suíte anterior.

## Validação e limites

`node --test tests/faisca-r240-private-loopback-http.test.mjs tests/faisca-r241-loopback-absolute-deadline.test.mjs`, mais `npm test`, `npm run test:browser`, SEO/build, Portal/Onepage, agentes PHP e PostgreSQL descartável na HEAD exata da PR.

R241 não verifica HTTPS externo, a VPS, exposições na rede, Docker operacional, autenticação válida, conversas Luna/Terra, gastos, revisão editorial ou Portal/Sites reais. Não realiza implantação, faturamento, captura de lead, DNS, merge ou habilitação pública. A experiência do mascote, `main` e `publicFaiscaEnabled=false` permanecem inalterados. O relato anterior de teste pago e homologação R92 não deve ser repetido. A instalação de R95–R241 em staging privado requer evidência operacional separada e revisão AppSec/LGPD/FinOps/editorial. **NO-GO público.**
