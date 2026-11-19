# Imagine Comercial F326 — consolidação de jornada e paridade Portal

**Escopo:** juntar as entregas já verificadas #407 (interface PT/EN/ES), #406 (núcleo de preços homologável pelo Portal V5) e #408 (demonstração navegável offline) em uma só branch de revisão, **sem merge para main, deploy ou PSP**.

## Alterações reais

1. A `CommercialChoicePreview.astro` PT/EN/ES continua com escolha anônima de Onepage/Landing/sem site, Google/Meta e faixa mínima/recomendada; 66 mensagens de WhatsApp revisadas são geradas pelas listas permitidas da #407. Nenhum formulário de cadastro, login ou pagamento.
2. `commercial-choice-preview.mjs` deixa de duplicar preços: lê `commercial-selection-preview.mjs`, que deriva os pisos e o cálculo de honorários de `media-budget-calculator.mjs`.
3. `tests/commercial-selector-portal-parity.test.mjs` verifica **24 combinações** (3 sites × 4 seleções de canais × 2 faixas), sem antecipar a mensalidade ou converter mídia em cobrança.
4. O teste `ops/review/purchase/test-portal-v5-financial-parity.mjs` executa PHP do Portal em SHA fixa `b90f6d8d30fe82509823e9eeee903446140857db` na CI. Compara Onepage, Landing, Google e Meta; verifica mínimo Google R$1.000/Meta R$700, ativação R$490/canal, gestão 20% com mínimo R$170/canal e rejeição a checkout de ChatGPT Ads.
5. A prévia F325 é preservada como **arquivo HTML navegável isolado** e screenshots 375/1440 produzidos em GitHub Actions, sem rota pública, `dist`, VPS, checkout nem dados de cliente.
6. Texto de `total` PT/EN/ES corrigido para não apresentar implantação completa + ativação como tudo vencendo agora. Para os sites, a implantação tem três parcelas D0/D30/D60 e a mensalidade começa em D+90 **da contratação**, independentemente da publicação; a gestão de anúncios é pós-paga e depende de gasto real verificado.

## Regras de segurança

- Mídia paga diretamente ao provedor Google/Meta. Não coletar essa verba no PSP da Imagine.
- Orçamento mínimo de anúncio não é garantia de resultados. Faixa recomendada é orientação inicial, não previsão de leads ou contrato.
- Aprovação de ChatGPT Ads é apenas estudo de elegibilidade, sem checkout operacional.
- A seleção no navegador **não é orçamento autorizado**: Portal deve recalcular, validar contrato/assinatura, sessão, empresa/tenant, autorização, MFA, itens, meio de pagamento e todos os tetos e pisos antes do aceite.
- O fluxo combinado *site + múltiplos canais* é simulação editorial. Não presume carrinho agregado ou aceite unificado já implementado pelo Portal.
- Não existe conector de CRM, idempotência de pedido real, NFS-e, webhook, credenciais de PSP nem navegação para ambiente privado a partir desta prévia pública.

## Evidências e gates

O CI F326 deve verificar a HEAD exata da branch. Exigir sucesso de:
- build Astro, acessibilidade e browser PT/EN/ES;
- testes de regressão do seletor e outbound allowlist;
- pin do Portal PHP V5 e testes de cálculo;
- artefato offline navegável (Chromium/Axe) para revisão visual.

**Permanece bloqueado:** mesclar em main, publicar domínio/Cloudflare/Leaseweb, habilitar checkout público, provisionar cliente, disparar pagamento ou ativar campanhas. Os gates de produção incluem reconciliação de versões do Portal, permissões IAM/MFA/RLS, aceite LGPD/contratos, apuração de mídia, cálculo do primeiro mês parcial, conciliação PSP em sandbox, auditoria, backup/rollback, testes end-to-end e autorização de publicação após evidências.

**DRAFT / NO-MERGE / NO-DEPLOY / NO-PRODUCTION-CHARGE.**
