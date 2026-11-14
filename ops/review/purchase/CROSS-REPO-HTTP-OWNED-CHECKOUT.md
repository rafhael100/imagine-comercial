# Comercial P0 — jornada HTTP real entre dois projetos, exclusivamente em CI

## Entrega

O workflow `comercial-portal-http-owned-checkout.yml` executa duas aplicações **de código real** em laboratório descartável:

1. Compila a homepage Astro do Imagine Comercial na HEAD exata com a prévia privada ativada somente no GitHub Actions; serve-a apenas por `127.0.0.1:18084`.
2. Faz checkout do Portal na SHA fixa `6f0c092dfe7febf69cf5a304950c019da9ddcd0f` (PR Portal #755 — catálogo v4, componentes Asaas e canal Google/Meta na mesma árvore). Compila seu Dockerfile, inicializa PHP/Laravel, Nginx e PostgreSQL18 em Docker Compose privado (único gateway de loopback `127.0.0.1:18083`), instala schemas sintéticos.
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

A partir da revisão da PR Portal #755, o teste HTTP deste repositório passou a fixar a SHA `6f0c092dfe7febf69cf5a304950c019da9ddcd0f`: catálogo v4 (antecipação dos honorários de gestão pelo planejamento e acerto pelo gasto efetivo), checkout e os componentes Asaas de #745, acrescidos do contexto Google/Meta de #746. O Comercial segue **sem calcular preço** nem emitir cobrança. Os quatro pedidos de teste verificam a oferta apresentada, não liquidação financeira nem períodos futuros. A prova final requer os workflows de ambos os repositórios concluídos na SHA exata.

## Evolução: checkout + segurança SQL assinada + restauração, na mesma prova de HTTP

A fonte externa de código foi atualizada para a PR Portal #755 (`6f0c092dfe7febf69cf5a304950c019da9ddcd0f`). Essa versão agrega à jornada Comercial → Portal o contexto Google/Meta, catálogo v4, recibos fictícios, fontes Asaas sintéticas F387–F392, SQL de propriedade por cliente assinado (HMAC e `FORCE ROW LEVEL SECURITY`), rotina de pós-venda e prova de restauração PostgreSQL18, além de artefatos de aceite editorial Ed25519 compatíveis com Sites. **Nada disso cria contrato ou autorização operacional.**

O workflow foi alterado para aplicar os três schemas do Portal **antes** de iniciar a aplicação Laravel, porque essa versão recusa leituras sem a chave e as políticas de escopo já instaladas. Depois do Chromium carregar o HTML real do Comercial:

- O primeiro cliente cria quatro pedidos fictícios; um **segundo cliente**, ainda na mesma empresa sintética, recebe HTTP 404 ao tentar consultar e alterar pedidos alheios; o primeiro reencontra seus quatro pedidos ao se autenticar novamente.
- O teste independente de pós-venda do Portal cria pedidos e eventos sintéticos adicionais e exercita produção, entrega, ajustes e aprovação, sem chamar o Sites, CRM ou o Asaas.
- Os testes SQL originais do Portal tentam enumerar clientes e pedidos com o próprio login restrito do banco e forjar variáveis de sessão de administrador/cliente. A política HMAC deve negar os acessos.
- O `verify_pg_restore_ci.sh` do Portal faz dump/restore de um banco descartável novo, compara clientes, pedidos, briefings, eventos e políticas RLS. Não é backup, restore ou deploy da VPS Leaseweb.
- Os quatro links HTTPS da página Comercial continuam **sem serem visitados**. A navegação de CI substitui seus destinos apenas no DOM de teste para dois servidores em loopback. Não existem credenciais ou chamadas externas ao Asaas.

**Gates externos restantes:** real IAM/MFA, plano de contas e ledger financeiro por cliente, Asaas sandbox com segredos fora do repositório, aceites jurídicos, emissão fiscal, provisionamento Sites real, revisão de segurança, backups da VPS e homologação TLS autenticada. Manter **DRAFT / NO-GO / NO-MERGE / NO-DEPLOY / NO-CHARGE**.

## Próxima validação financeira P0 — Asaas Sandbox GET-only offline

A candidata Portal #755 mantém todas as regras, schemas, contextos de cliente e testes anteriores, acrescentando um **probe estritamente de leitura**, com destino fixo `GET https://api-sandbox.asaas.com/v3/payments?offset=0&limit=1`. O Comercial fixa essa árvore na SHA `6f0c092dfe7febf69cf5a304950c019da9ddcd0f` para seu teste ponta a ponta de laboratório.

O workflow do Comercial executa também `php tools/test_asaas_sandbox_readonly_probe.php` do Portal pinado **no runner**, com transporte de rede injetado e respostas totalmente fictícias. O teste recusa chaves de produção, alteração de verbo/host, erros HTTP, redirecionamento, formatos inesperados, payloads excessivos e uma falsa confirmação de pagamento. Nenhuma chave é instalada e o test runner não acessa o PSP.

Não é prova de **conectividade real** ao Sandbox: o operador ainda precisará executar o preflight somente leitura com credencial sandbox protegida, em ambiente autorizado, seguido por testes de PSP e ledger operacional. A CI não conecta Asaas, não gera boleto ou Pix, não faz cobrança e não libera Sites.
