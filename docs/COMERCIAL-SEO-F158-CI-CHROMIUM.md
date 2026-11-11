# Comercial SEO-F158 — Instalação do Chromium independente de fontes extras do apt

A RC34 teve dois pipelines interrompidos **antes dos testes de navegador** devido à falha temporária de resolução DNS do mirror de pacotes Ubuntu durante `npx playwright install --with-deps chromium`. O log de ambos os jobs mostra `Temporary failure resolving 'azure.archive.ubuntu.com'` ao baixar fontes opcionais. Isso não era evidência de defeito funcional do site.

Os workflows `validate.yml` e `commercial-lighthouse-lab.yml` passam a usar `npx playwright install chromium` após `npm ci` no Ubuntu 24.04, preservando a instalação do browser emparelhado com a versão do Playwright no lockfile e todos os testes Playwright, axe-core e Lighthouse existentes. A mudança **não desliga validações**, não ignora failures e não acrescenta despesas.

Uma instalação incompleta ou dependências fundamentais ausentes ainda deve causar falha explícita na execução. Se o próprio servidor de download do browser estiver indisponível, o CI continua bloqueado; não declarar aprovação sem execução real. É um ajuste de confiabilidade do laboratório, não autorização de produção.

**HOLD:** sem merge `main`, deploy, DNS, redirecionamentos, OAuth real ou coleta de dados de clientes. Revisão independente/estágio privado ainda necessários.
