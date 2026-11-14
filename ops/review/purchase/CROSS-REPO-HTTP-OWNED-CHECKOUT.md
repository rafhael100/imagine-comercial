# Comercial P0 — jornada HTTP real entre dois projetos, exclusivamente em CI

## Entrega

O workflow `comercial-portal-http-owned-checkout.yml` executa duas aplicações **de código real** em laboratório descartável:

1. Compila a homepage Astro do Imagine Comercial na HEAD exata com a prévia privada ativada somente no GitHub Actions; serve-a apenas por `127.0.0.1:18084`.
2. Faz checkout do Portal na SHA fixa `ea26bbacc15a6d3b34dad56d85120de7fcc793b7` (PR Portal #750 — catálogo v4, componentes Asaas e canal Google/Meta na mesma árvore). Compila seu Dockerfile, inicializa PHP/Laravel, Nginx e PostgreSQL18 em Docker Compose privado (único gateway de loopback `127.0.0.1:18083`), instala schemas sintéticos.
3. Chromium acessa **a homepage Astro servida por HTTP**, examina os quatro CTAs exatos ao Portal HTTPS privado e preserva seus pares `product` / `channel`. Como é laboratório, somente no DOM descartável de CI o destino aprovado é mapeado para o gateway **local** antes do clique. Nunca faz requisição real ao host Portal de desenvolvimento.
4. Executa cadastro fictício individual, contratação Onepage, pagamento **fictício** e briefing, contratação Landing Page, contratação Google Ads com R$ 700 e contratação Meta Ads com R$ 700. Confere que os valores foram calculados pelo PHP do Portal: Onepage R$ 990 / inicial R$ 330, Landing Page R$ 1.290 / inicial R$ 430, honorários Performance R$ 140 por canal, sem combinar mídia aos honorários.
5. Confirma quatro pedidos pertencentes à mesma conta de teste no PostgreSQL18 e encerra o banco e contêineres. Também proíbe requisições HTTP de navegador que não sejam `127.0.0.1`.

## Escopo de prova

Essa é uma prova de integração de código/navegador e persistência em banco, **não** um teste ponta a ponta da infraestrutura publicada. Nenhum login oficial, conta de cliente, PSP, e-mail, CRM, Sites ou nota fiscal é acionado. Os links finais HTTPS não são visitados: o mapeamento para loopback é exclusivo do navegador de CI. O `GITHUB_ACTIONS` sozinho não habilita o modo Astro privado; é exigido também `IMAGINE_ASTRO_PRIVATE_PORTAL_PREVIEW=1`.

## Gates antes de operação com clientes

- Testar os domínios definitivos protegidos por TLS e identidade real, com fluxo entre origens e políticas de cookies revisados;
- Integrar os candidatos independentes de checkout e Asaas do Portal numa HEAD validada, com chave sandbox mantida fora do GitHub, e completar conciliação e ledger;
- Testar falha, duplicação, estorno, recorrência D30/D60/D90, contrato e aceite;
- Emissão fiscal, provisão idempotente Sites, retenção LGPD, backups/rollback da VPS, revisão AppSec/DBA;
- Aprovação humana da SHA e ambiente exatos para lançamento.

**Status:** DRAFT / NO-GO / NO MERGE / NO DEPLOY / NO CHARGE. Não altera `main` nem publica o site público ou privado.

## Atualização para fonte financeira consolidada

A partir da revisão da PR Portal #750, o teste HTTP deste repositório passou a fixar a SHA `ea26bbacc15a6d3b34dad56d85120de7fcc793b7`: catálogo v4 (antecipação dos honorários de gestão pelo planejamento e acerto pelo gasto efetivo), checkout e os componentes Asaas de #745, acrescidos do contexto Google/Meta de #746. O Comercial segue **sem calcular preço** nem emitir cobrança. Os quatro pedidos de teste verificam a oferta apresentada, não liquidação financeira nem períodos futuros. A prova final requer os workflows de ambos os repositórios concluídos na SHA exata.
