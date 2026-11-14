# Comercial P0 — evidências para a decisão de lançamento

O verificador `check-release-evidence.mjs` é um **inventário local**, não uma autorização automática de implantação. Só confere que foram preenchidos oito gates, hashes de 40 caracteres e URLs de evidência no GitHub. Não consulta o GitHub, não verifica a autenticidade da evidência e não aprova pagamentos.

## O que está demonstrado

- Homepage Astro, acesso condicional "Portal do Cliente" em desktop/mobile e quatro CTAs de homologação: PR Comercial #374; testes de CI descritos na PR.
- Portal de homologação possui cadastro individual, pedidos e briefing fictícios, persistência e acompanhamento: PRs Portal #695 e #732.
- Prévia Comercial na VPS protegida por Basic Auth; não equivale a site comercial público: PR Comercial #372.

## O que ainda impede a contratação verdadeira

1. Página, host e recuperação de conta do Portal autenticados e testados na VPS final, com sessões, isolamento de clientes e auditoria.
2. Catálogo de valores e condições juridicamente aprovados e versionados; comparar a primeira versão Node sem assumir que qualquer preço antigo ainda é vigente.
3. Integração Asaas em ambiente de teste e depois produção, com confirmação do recebimento verificada no servidor, deduplicação, reconciliação, reembolso e tratamento de falhas.
4. Pedido e assinatura vinculados à identidade autenticada; estado do pagamento nunca depender de retorno do navegador nem de JSON editável pelo cliente.
5. Emissão fiscal e provisionamento idempotente de Sites somente para pedidos elegíveis e pagamento confirmado.
6. Backup, restauração, rollback, segredo, isolamento de contêineres, TLS e observabilidade da VPS.
7. Avaliação independente de segurança, proteção de dados e termos comerciais.
8. Aceite explícito e específico do operador para a versão exata e ambiente de produção.

## Uso do inventário

```sh
node --test tests/comercial-release-evidence.test.mjs
node ops/review/purchase/check-release-evidence.mjs /caminho/privado/evidence.json
```

A evidência deve ter `environment: "production"`, `releaseApproval: "approved-by-operator"`, `comercialCommit`, `portalCommit` e `gates` contendo cada ID de `REQUIRED_GATES`, com `status: "pass"`, `verifiedCommit` e `evidence` (URLs de PRs ou GitHub Actions da organização). Não inserir tokens, senhas, CPF, CNPJ de clientes ou payloads do Asaas no arquivo.

**Mesmo com inventário completo, a mensagem é "MANUAL REVIEW REQUIRED; NO DEPLOY AUTHORIZED".** É preciso confirmar remotamente cada execução na SHA correta, fazer testes reais de homologação e obter aprovação humana. Não conectar esta saída diretamente a `deploy` ou `merge`.

**Estado atual:** DRAFT / NO-GO / sem publicação. As evidências apontadas acima não cobrem os oito gates de produção.
