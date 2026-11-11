# P0 F176 — Prova assinada e uso único para ensaio privado de orçamento

## Entrega de código real, **não** ativação pública

O orçamento possui sete campos visuais na prévia privada e análise estrutural em um servidor HTTP descartável, mas não havia ainda um contrato de prova de requisição **assinado**, de curta validade e vinculado à sessão de teste. A F176 adiciona o módulo `src/lib/private-budget-request-proof-lab.mjs`, com HMAC-SHA256, nonce criptograficamente aleatório (18 bytes), origem loopback, escopo de sessão sintético, expiração fixa de 120 segundos e consumo único via adaptador de reserva de nonce.

O verificador compara MAC de forma resistente a diferenças de tempo, rejeita token modificado, formato divergente, escopo/origem diferentes, relógio adiantado/expirado e segunda tentativa. Uma função `claimNonce` deve efetuar a reserva atômica; no laboratório, o registro é apenas um `Set` em memória, **não** um banco durável nem implementação de produção. O resultado é um diagnóstico sem campos confidenciais, com `canPersist=false`, `canAcknowledgeVisitor=false`, `publicIntakeAllowed=false`.

## Ensaio HTTP separado

Um servidor exclusivo de testes, restrito a `127.0.0.1`, oferece `GET /__lab/budget/request-proof` e `POST /__lab/budget/request-proof/verify`, sempre com autenticação Basic sintética, Host exato, verificação de Origin no POST, corpo JSON pequeno, sem cookies nem cache. **Só aceita tokens**. Rejeita e-mail/contato, corpo maior que 1 KiB, método, Host e Origin não autorizados, assinatura inválida e replay. Não importa rotas Astro nem persiste dados. Testes Node cobrem 50 tentativas concorrentes, expiração, tampering, falso HMAC, falta de reserva, isolamento e HTTP real no loopback.

**Limite de segurança importante:** nonce assinado e problema aritmético **não são uma solução antirrobô suficiente**, tampouco provam identidade, consentimento LGPD, vínculo de tenant ou entrega CRM. Antes de ativar F70, a equipe precisará definir defesa contra abuso, serviço autenticado, retenção/consentimento, armazenamento atômico de nonce entre instâncias, Portal→CRM, ACK durável, UX e homologação independente. Esta entrega **não** toca em produção, domínio, clientes, gastos ou VPS.
