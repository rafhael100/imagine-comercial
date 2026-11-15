# Jornada privada de demonstração — D01

Simulador separado do checkout operacional: **não usa Asaas/C6, identidade real, MFA, banco de clientes ou provisionamento**. Não comprova a integração operacional descrita no Portal issue #830. Permite percorrer o desenho completo com site + Google/Meta preservados, inclusive pagamento pendente/recusado e briefing bloqueado até aprovação fictícia.

PHP recalcula os valores; a URL só aceita enums de seleção. Conta fictícia fixa (sem senha/PII), sessão exclusiva, CSRF, rotação ao identificar-se, nonce/revisão de pedido, repetição de aprovação sem duplicar, cookies Secure/HttpOnly/SameSite, respostas no-store/noindex, CSP sem rede externa. A gravação usa somente arquivos de sessão do contêiner de demonstração, isolados do Portal.

## Implantação privada autorizada

- Host aceito exclusivamente `comercial-dev.imaginecomunica.com.br`.
- PHP 8.3+; `IMAGINE_CUSTOMER_SIMULATION=private-demo-v1`.
- Diretório de sessões gravável `/data/sessions`; dados fictícios, nunca versionados.
- Publicar o contêiner apenas em `127.0.0.1:18085`, sem segredos ou mounts do Portal.
- Proxy em `/simulacao/compra/` deve **manter a mesma autenticação Basic já existente**, sem CORS, sem liberação pública, sem alterar os outros ambientes.
- `commercial-demo-link.js` é um overlay apenas do document root de desenvolvimento, não entra em `public/`, `dist/` nem no build público. Injeta o atalho da simulação e captura a seleção da home.
- Reversão: restaurar HTML antes do overlay, remover somente o location específico do simulador, validar/recarregar Nginx, parar apenas o contêiner `imagine-customer-simulation`.

## Escopo financeiro ilustrativo

Onepage R$990 em 3×330; Landing R$1290 em 3×430; R$79,90/mês em D+90. Ativação R$490/canal; Google mídia mínima R$1000 e recomendada R$1500, Meta R$700/R$1000. Gestão estimada por canal `max(R$170, 20% mídia planejada)`, separada da mídia paga à plataforma. Demonstração de mês completo; não ratifica competência parcial, contrato, nota fiscal ou fatura real.

Entrada: `https://comercial-dev.imaginecomunica.com.br/simulacao/compra/`.
Teste: `python3 ops/private-customer-simulation/test_flow.py` (PHP local e HTTP de loopback; nunca chama instituição financeira).
 
## Validação na VPS — 15/11/2026 UTC

PHP 8.4: lint de app.php e view.php aprovado. Cinco testes HTTP aprovados, incluindo matriz de 24 seleções (22 válidas e duas vazias rejeitadas), pedido combinado, pendência/recusa/aprovação, repetição idempotente, briefing, painel, CSRF e isolamento entre sessões. Nginx -t aprovado; rota ativada com a mesma senha Basic; overlay PT/EN/ES instalado com backup. Revisão visual no navegador permanece pendente: acesso retornou ERR_INVALID_AUTH_CREDENTIALS. Não considerar esta evidência como homologação visual, pagamento bancário ou conclusão do checkout operacional do Portal.

O include do location fica no bloco server HTTPS em sites-available/imagine-dev, ao lado dos includes existentes; não dentro do snippet da location estática. Contêiner ligado a bridge exclusiva, publicado somente em loopback. Não remover a autenticação para testar.

## Terceiro canal de demonstração — ChatGPT Ads

O simulador aceita chatgpt_ads isolado ou combinado com Google/Meta. Mídia ilustrativa R$1.200/30 dias (R$40/dia) ou recomendada R$1.800/30 dias; ativação Imagine R$490 e gestão max(R$170,20% da mídia). R$1.200 não é um mínimo mensal universal da plataforma: é o planejamento de 30 dias. Referência oficial consultada em 15/11/2026: https://help.openai.com/en/articles/20001210-creating-campaigns-for-chatgpt-ads (BRL40/dia); disponibilidade de autoatendimento Brasil: https://help.openai.com/pt-br/articles/20001245-ads-manager-availability . Conta, anúncios e veiculação continuam sujeitos à aprovação e condições da plataforma.

Somente a jornada fictícia ganhou o terceiro canal: o gate de checkout operacional do Portal e a precificação pública validada contra o Portal continuam restritos aos canais já homologados. Não tratar a simulação como integração operacional OpenAI Ads. Seis testes HTTP passam incluindo todas as oito combinações ChatGPT com/sem Google/Meta e mínimo/recomendado, com aprovação fictícia, briefing e painel.

## Parcelamento aprovado — 15/11/2026

Novas simulações usam DEMO-V2-3X-2026-11-15: implantação + todas as ativações juntas em 3x sem juros, D0/D30/D60. Duas primeiras parcelas são floor(total/3), a última recebe os centavos restantes; soma exata ao total. Mensalidade do site em D+90 e gestão pós-paga permanecem separadas. Pedidos fictícios anteriores preservam seu snapshot; iniciar nova simulação para experimentar a nova regra. Esse ajuste foi aplicado à estimativa comercial e ao demonstrador, não altera cobrança real do Portal/PSP.

Bloco comercial da calculadora incluído após o seletor nos três idiomas, usando as rotas já existentes, sem captura de dados ou promessa de resultado.

## Seletor anônimo da home — terceiro canal

ChatGPT Ads agora integra também a estimativa pública do componente CommercialChoicePreview, com parâmetros reutilizados da calculadora (R$1.200 mínimo / R$1.800 recomendado). São 48 seleções e 46 mensagens opt-in por idioma, sem dados pessoais. O gate operacional Portal continua rejeitando ChatGPT explicitamente e não o mapeia silenciosamente para Google/Meta. O overlay privado preserva os três enums e abre a demonstração. A inclusão na estimativa não comprova contratação, pagamento ou veiculação reais.
