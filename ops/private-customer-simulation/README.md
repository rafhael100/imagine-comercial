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
