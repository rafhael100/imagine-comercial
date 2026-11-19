# Imagine Comercial — homologação privada do fluxo de contratação fictícia

## O que já pode ser provado sem contas reais

O workflow \`commercial-purchase-simulation.yml\`:
- Gera uma cópia independente da home Astro preservando a primeira seção visual, com quatro CTAs de simulação;
- Testa Onepage, Landing Page e Performance por navegação local, incluindo pagamento fictício pendente, recusado e aprovado;
- Executa **HTTP real somente no loopback 127.0.0.1**, iniciando em cada botão de oferta da home compilada e percorrendo nove etapas;
- Acrescenta uma camada **Basic Auth de teste**: exige HTTP 401 sem credenciais e, com credenciais fictícias apenas no runner CI, completa os quatro percursos no navegador.

Esses testes não demonstram que o servidor real está autenticado ou que o motor do Imagine Portal está conectado. O estado é **SIMULAÇÃO / NO-GO para contratação efetiva**.

## Auditoria opcional autorizada contra o staging privado da VPS

O teste remoto é **opt-in**, não executado pelo CI. Só aceita o endereço exato:
\`https://comercial-dev.imaginecomunica.com.br\`

1. Operador autorizado confirma previamente que o ambiente continua protegido por autenticação Basic e que contém **apenas dados fictícios**.
2. No computador do operador com Python e Chromium instalados, preparar Playwright: \`python3 -m pip install 'playwright==1.56.0'\`. Se não houver Chrome instalado, configurar o navegador do Playwright na máquina local.
3. Introduzir credenciais no terminal **sem colocá-las em argumentos, issues, comentários de PR ou arquivos versionados**:

\`\`\`bash
read -r -p 'Usuário Basic do staging: ' IMAGINE_STAGING_BASIC_USER
read -r -s -p 'Senha Basic do staging: ' IMAGINE_STAGING_BASIC_PASSWORD
printf '\n'
export IMAGINE_STAGING_BASIC_USER IMAGINE_STAGING_BASIC_PASSWORD
python3 ops/review/purchase/test_protected_staging_browser.py --approved-remote
unset IMAGINE_STAGING_BASIC_USER IMAGINE_STAGING_BASIC_PASSWORD
\`\`\`

O comando faz apenas GET/visualização do site privado; não executa POST de compras, usa HTTPS com validação TLS, bloqueia outros domínios, recusa redirecionamentos e exige **401 sem credenciais** em \`/\` e \`/simulacao/\`. Depois entra nas nove etapas com credenciais fornecidas diretamente ao navegador, usando nomes fictícios e cenários de pagamento simulados. Verifica os relatórios finais com cinco confirmações explícitas de que não houve operação real. O script não exibe nem grava credenciais no relatório.

**Importante:** o modo remoto não foi executado nem homologado automaticamente nesta PR. O teste com navegador autenticado no CI usa somente um servidor fictício e uma senha fictícia.

## Critérios antes da integração operacional

O primeiro checkout efetivo exigirá serviço/autorização persistentes no Portal, IAM e MFA homologados, escopo multiempresa e RLS, vínculo de pedido, recibo durável, capacidade de revogação, termos/consentimento, orquestração Sites/CRM, gateway de cobrança aprovado e revisões AppSec/DBA. Nenhum desses itens é liberado pelo teste de simulação.
