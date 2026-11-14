# Imagine Comercial — F316: contrato sintético com o Imagine CRM

## Por que validar entre repositórios

A calculadora do Comercial já produz números em BRL e um envelope de
interesse **sintético**, sem identidade. O CRM implementou no PR #569
validação equivalente no PHP, incluindo escopo, assinatura HMAC de
laboratório, janela de validade, detecção de adulteração e recusa
permanente de qualquer permissão de armazenamento de lead ou envio.

Em vez de confiar que as PRs continuarão compatíveis, esta rodada
adiciona **um workflow no repositório Comercial**, usando exatamente o
SHA `69159795fa47d3362e20649b01d3a8d788875b9c` do CRM:

1. Obter o código atual do Comercial sem salvar credenciais GitHub;
2. Obter apenas a versão **imóvel** do CRM revisado;
3. Gerar vetor descarável Node com
   `scripts/emit-calculator-interest-fixture-ci.mjs`;
4. Encaminhar esse JSON fictício por pipe **local** ao inspetor PHP
   `scripts/ci/check-calculator-interest-crossrepo.php`;
5. Provar HMAC/estrutura corretos e rejeitar pedido alterado para
   consentimento de marketing sem MAC legítimo;
6. Reexecutar os testes de mensagens curadas (21 opções PT/EN/ES)
   e de limites da integração sintética.

Não existe endpoint real, chave privada, tenant de cliente, e-mail,
contato pessoal, Laravel em execução ou contato com PostgreSQL nesse
workflow: o PostgreSQL de laboratório já possui outros testes separados.

## O que ainda falta para uma captação real

- Backend Laravel de entrada autorizado por empresa e origem confiável;
- Prova validada de identidade/consentimento, aviso e finalidade;
- Rate limit, CSRF/antiabuso, rotação de chaves, criptografia e backup;
- Persistência idempotente com isolamento por empresa e recibo verificável;
- Envio de relatório solicitado distinto de marketing opcional com
  confirmação, revogação e descadastro;
- Verificação de segurança e LGPD, staging, auditoria e autorização de
  publicação separada.

O contato por WhatsApp da F315 é **manual** e não cria lead no CRM. As
evidências de CI comprovam somente paridade técnica do vetor sintético,
não um serviço de nutrição funcional.

**REVIEW-ONLY / NO-MERGE / NO-DEPLOY / NO-CRM-WRITE /
NO-LIVE-PII / NO-MARKETING / NO-CHARGE.**
