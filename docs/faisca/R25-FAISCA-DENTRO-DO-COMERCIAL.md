# Faísca R25 — conversa integrada à página comercial em revisão privada

**Base:** R24, [PR #487](https://github.com/rafhael100/imagine-comercial/pull/487). **Escopo:** homologação visual e funcional no navegador do Imagine Comercial real compilado, sem ativação do widget público.

## Avanço funcional

A R24 disponibiliza um CTA privado na homepage para abrir a jornada do Faísca em outra página. Isso prova a navegação entre os artefatos, mas não a coexistência da conversa com o simulador de compra.

A R25 acrescenta o controle acessível **Testar o Faísca dentro do site** no mesmo bloco privado. Ao expandir esse controle, a jornada R08 é exibida em um iframe de revisão, enquanto os CTAs de venda, simulador, navegação e rodapé do Comercial permanecem na página. O revisor consegue iniciar a qualificação, escolher Onepage, confirmar serviço e consultar o resumo sem sair do contexto comercial.

O link separado da R24 continua disponível, como alternativa de revisão e fallback. Nenhuma alteração foi feita em `src/pages/index.astro` ou no arquivo `dist/index.html` compilado. A marcação extra é injetada exclusivamente na resposta HTTP do servidor F154 protegido por Basic Auth e vinculado a `127.0.0.1`.

## Controles de segurança e usabilidade

- Controle nativo HTML `<details><summary>...`: abre/fecha com teclado sem JavaScript novo na homepage.
- Iframe com título, carregamento preguiçoso e `referrerpolicy=no-referrer`. Os módulos continuam sendo os arquivos R22 assinados por SHA-256 no manifesto, servidos sob a mesma origem autenticada.
- A página comercial mantém `X-Frame-Options: DENY`. **Somente** `/__faisca_preview/journey/` e `/__faisca_preview/support/` recebem `SAMEORIGIN` e `frame-ancestors 'self'`, depois da autenticação. A política geral não é relaxada.
- O iframe de revisão possui `sandbox=allow-scripts allow-same-origin allow-forms` para permitir o carregamento correto dos módulos Astro na mesma origem. **Esse conjunto de flags não deve ser tratado como isolamento de segurança contra scripts arbitrários**. O controle de confiança é o build revisado, sua verificação de hashes e o acesso privado.
- `allow-forms` permite que o navegador dispare o evento do formulário do chat, interceptado pelo JavaScript local. Não libera envio pela rede: a CSP mantém `form-action 'none'` e o servidor somente aceita GET/HEAD. Não existem endpoints de captura, checkout, pagamentos, CRM, PHP ou LLM externo.
- Um rótulo explícito alerta que a conversa é local/simulada e não deve receber dados pessoais ou senhas.

## Gates automatizados

- Testes R24 ampliados: verificam a presença do controle e do iframe somente no HTML privado, ausência dessas alterações no `dist/index.html`, `SAMEORIGIN` apenas nas páginas de revisão e `DENY` na homepage.
- Chromium R24/R25: expande a conversa dentro do site real, ativa o Faísca, inicia Onepage, confirma e preserva a seleção, verifica a existência do simulador comercial, fecha o controle e executa também a navegação R24 e a triagem R10.
- O teste continua recusando tráfego para outros hosts, cookies, storage e rotas de escrita.

**A CI verde na SHA exata da R25 é obrigatória**. A demonstração não é prova de implementação do futuro widget público, LLM real, contratos, pedidos ou pós-venda autenticado.

## Passos que faltam antes de publicar

A integração definitiva deverá ter componente e design próprios no Astro público, proteção contra conflito de CSS/IDs, avaliação de Core Web Vitals e SEO, aprovação editorial PT/EN/ES, consentimento e privacidade conforme o caso, provider IA homologado, regras de custo, recebedor Portal/CRM seguro, staging HTTPS com backup/rollback e autorização de GO. Nenhum desses gates é substituído pelo iframe de revisão.

Sem alteração do mascote, `main`, DNS, VPS, custos, credenciais ou dados de clientes.
