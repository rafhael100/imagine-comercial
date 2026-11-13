# F252 — Contato contextualizado também na página inicial

A homepage destacava três soluções comerciais, mas exigia abrir a página editorial para então preparar um contato sobre o serviço.

A F252 adiciona um segundo link **Preparar contato** em cada cartão de destaque, mantendo o botão **Conheça a solução**. Os destinos são fixos e revisados: `/contato/#criacao-de-sites`, `/contato/#landing-pages` e `/contato/#gestao-google-ads`. A página de contato reconhece o slug permitido e inicia as opções públicas do briefing, sem pré-preencher nome, telefone ou dados de cliente.

- O visitante escolhe a navegação desejada; não há envio automático, tracking, cookies, POST ou formulário público.
- O aviso de que nada foi enviado aparece junto aos cartões e é associado aos links por `aria-describedby`.
- Os atalhos têm nome acessível por serviço, foco visível, altura mínima de 44px e comportamento de link nativo sem dependência de JavaScript.
- O bloco visual mantém a logo original Imagine, o laranja `#F9941D`, fundos neutros, links contrastantes e navegação responsiva já aprovados nas F240–F251.
- Testes Node e Chromium verificam o conjunto exato de três slugs, destinos e seleção do serviço na tela de contato.

**Limite:** não é captação de orçamento, integração real Portal→CRM, publicação, configuração de domínio, aprovação SEO de redirecionamento ou contrato. Produção e `main` continuam intocadas.
