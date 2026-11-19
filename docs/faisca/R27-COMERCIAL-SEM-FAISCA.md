# Faísca R27 — o site continua funcional sem o assistente

**Base:** [Faísca R26 #489](https://github.com/rafhael100/imagine-comercial/pull/489). **Escopo:** prova negativa em navegador real do Comercial Astro e do Faísca, com dados exclusivamente sintéticos e staging autenticado em loopback.

## Critério de produto

O Faísca deve ajudar a vender, não criar uma dependência de disponibilidade que bloqueie o site. Mesmo se o script do assistente falhar, for bloqueado, demorar ou se o visitante usar o site sem JavaScript, as páginas do Comercial precisam continuar legíveis, os CTAs precisam apontar para locais corretos, a navegação deve funcionar e a simulação comercial não pode virar um formulário de checkout não homologado.

## Entrega executável

O novo `ops/faisca/composition/failure-browser-qa.mjs` usa o **mesmo HTML Comercial real compilado** e o bundle Faísca R22, carregados pelo servidor privado de R24/R25. Ele executa três ensaios independentes:

1. **JavaScript desativado, tela de 320 px:** o CTA de intenção de compra do Comercial continua sendo um link local para `#simular-compra`; há seletor estático Onepage; a navegação para `/servicos/` funciona; o painel privado Faísca abre com `details/summary`, exibe aviso `noscript` e não finge uma conversa ativa.
2. **Falha induzida do módulo do Faísca, desktop 1440 px:** o Chromium bloqueia seletivamente o arquivo `FaiscaJourneyLab...js` e comprova que o bloqueio ocorreu. O simulador comercial continua alternando Onepage/Landing Page por meio de seu script próprio; abrir ou fechar o painel do assistente não altera a escolha.
3. **Teclado e movimento reduzido, 390 px:** pressionar Enter sobre o `summary` abre e fecha o componente sem exigir uma API; nenhum checkout, campo de contato, cookie ou envio externo é introduzido.

Os testes verificam que a navegação permanece na mesma origem autenticada `127.0.0.1`, sem comunicação com provedores externos, e encerram o navegador/servidor após a execução.

## CI

No workflow Faísca, após a compilação do Comercial, auditoria do `dist` público R26 e execução integrada R24/R25, o gate R27 roda:

```bash
node ops/faisca/composition/failure-browser-qa.mjs
```

Qualquer falha impede a conclusão verde do workflow. Os demais testes (Node, PHP pinado, PostgreSQL efêmero, SEO, responsividade e acessibilidade) continuam inalterados.

## Limites de evidência

A prova é **local e em CI**. Ela não substitui teste real em staging HTTPS da Leaseweb, Core Web Vitals de campo, aprovação editorial ou revisão independente. O componente ainda não está publicado; a implementação final do widget público poderá usar outra arquitetura, que precisará repetir este mesmo critério de degradação.

Nenhuma alteração em `src/pages/`, `public/`, PNG/CSS do mascote, CRM, Portal, PSP, DNS, VPS, `main`, custos, credenciais ou dados de clientes.
