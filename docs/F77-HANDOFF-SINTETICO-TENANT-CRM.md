# F77 — Simulador de passagem Comercial → Portal → CRM por tenant

## Por que existe
O site comercial ainda não pode trocar WhatsApp/e-mail por um formulário real (gate F70). A F77 prepara, em Node puro e sem rede, o comportamento esperado de uma futura entrega de orçamento ao CRM multiempresa. Não utiliza dados de clientes, credenciais nem altera o build público.

## Contrato implementado
- `src/lib/synthetic-tenant-lead-handoff.mjs`: `SyntheticTenantLeadHandoff` valida tenant sintético prefixado por `lab-tenant-`, serviços publicados permitidos por tenant e uma marca de consentimento **exclusivamente fictícia**.
- Valida novamente os campos da F30 antes de simular uma entrada; não aceita campos extras ou tenant no objeto do lead.
- Idempotência isolada por tenant: o mesmo UUID pode ser usado em dois tenants diferentes sem misturar a caixa de entrada; uma repetição idêntica no mesmo tenant é reconhecida, mudança de conteúdo gera conflito.
- Falha fechada durante indisponibilidade simulada. Nenhuma entrada é confirmada quando o destino fictício está desligado.
- O recibo contém apenas UUID, estado fictício e flags `deliveryProven:false`, `deploymentAuthorized:false`; não expõe nome, e-mail, telefone ou mensagem.

## O que o simulador NÃO prova
O identificador de tenant e a marca de consentimento são **fixtures** e não autorização, sessão, controle de acesso ou prova jurídica. A entrada é armazenada apenas em memória de teste, sem transação persistente, trilha de consentimento, criptografia operacional, outbox, filas, retries de produção, MFA, OAuth ou confirmação do CRM.

Antes de habilitar um formulário real, o Portal precisará extrair o tenant de sessão/grants **autenticados do servidor**, aplicar a política efetiva, validar consentimento versionado, executar transações duráveis e devolver um recibo de entrega verificável. O CRM precisa receber registros apenas em tenant autorizado e aplicar retenção, exclusão e auditoria. A homologação privada, revisão LGPD e o gate F70 permanecem abertos.

## Testes
`node --test tests/synthetic-tenant-lead-handoff.test.mjs` verifica isolamento, replay, colisão, prova fictícia inválida, PII extra, falha do destino e ausência de importação pela página pública.

Nova PR **draft** empilhada sobre F76. Não modificar `main`, DNS, site atual, bancos persistentes, fornecedores ou dados reais sem autorização específica.
