# F63 — Navegação acessível e indicação de página atual

A navegação principal do Imagine Comercial agora inclui o acesso direto **Comparar**, sem exigir retorno ao diretório de serviços. Em cada rota diretamente representada pelo menu, somente seu link recebe `aria-current="page"`. A marca do site recebe `aria-current="page"` somente na homepage; não se marca uma seção genérica como se fosse a página ativa.

O CSS destaca visualmente o link atual com sublinhado, preservando a indicação sem depender apenas de cor. A navegação permanece composta por links HTML comuns e funciona com JavaScript desativado.

O QA de navegador percorre as rotas móveis e desktop, garante que o menu Comparar existe, valida que há zero ou uma página atual conforme a rota e testa a navegação por teclado: o primeiro Tab da homepage deve focar o atalho visível “Ir para o conteúdo”. Axe WCAG A/AA permanece aplicado às páginas principais. A rota de comparação foi adicionada na F60.

Nenhuma coleta de dados, alteração de preços, banco ou integração CRM/Portal. Não publica em produção; a revisão externa de conteúdo, VPS e SEO continua pendente.
