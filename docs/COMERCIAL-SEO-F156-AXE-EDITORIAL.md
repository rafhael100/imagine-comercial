# Comercial SEO-F156 — Teste de acessibilidade da biblioteca de conteúdos

A suíte de Playwright do Imagine Comercial passa a executar **axe-core WCAG 2.0 e 2.1 níveis A/AA** nas duas telas editoriais críticas: a biblioteca `/conteudos/` e um artigo completo `/conteudos/landing-page-ou-site/`, em viewport móvel e desktop. Isso complementa a cobertura anterior, concentrada na home, serviços e contato.

Os testes também validam **ativação por teclado** dos filtros F152 e do sumário F153: foco no botão, Enter, estado `aria-pressed`, quantidade de guias visíveis, foco no link de seção e navegação por fragmento. Depois de selecionar um tópico, a suíte repete a auditoria axe-core no estado filtrado.

O teste continua limitado ao `astro preview` de loopback, sem acesso a sites de clientes, contas de produção, Google, dados pessoais, formulários ou endpoints de captura. Não substitui auditoria com usuários de tecnologias assistivas ou revisão humana em staging.

**HOLD:** código e testes em PR draft, sem merge `main`, deploy, DNS, redirect 301 ou custos adicionais.
