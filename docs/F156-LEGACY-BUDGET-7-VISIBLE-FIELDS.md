# F156 — Correspondência visual 7/7 do orçamento legado (sem proteção antirrobô ativa)

## Entrega concluída em prévia privada

A prévia de orçamento existente em `tests/fixtures/private-contact-form-preview.html` agora apresenta **todos os sete controles visíveis inventariados** no site legado: nome, cargo, e-mail, telefone, celular, mensagem e campo de verificação aritmética. O sétimo controle é **ilustrativo**, sinalizado em português como não funcional e acompanhado de explicação de que o mecanismo real só poderá ser implementado e verificado no Portal.

O comparador `reviewLegacyBudgetPreviewParity` atribui o campo a `lead-challenge` e passa a informar **7/7 de correspondência visual**. O teste de CI garante que esconder, desabilitar ou retirar o campo reduz o resultado para 6/7. A prévia permanece com botão de envio **desabilitado** e nenhum endpoint; os relatórios de prontidão continuam com `antiBotOperationallyVerified=false`, `legacyDeliveryVerified=false`, `portalCrmDeliveryVerified=false`, `legacyContactIntakeParityApproved=false` e `deploymentAuthorized=false`.

## Bloqueios operacionais independentes

Correspondência **visual** não é paridade funcional. Ainda faltam contrato final de campos/obrigatoriedade, base legal, consentimento/proveniência, antifraude e CAPTCHA acessível server-side aprovado, validação de serviço público, recepção/ACK do Portal/CRM persistente, UI de erros/estados reais, teste operacional e autorização do release. O formulário público Astro **continua congelado** e sem POST, cookies, captura ou dados reais.

Sem alteração da `main`, deploy, DNS, redirects, gasto de fornecedor ou credenciais.
