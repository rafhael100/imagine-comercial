# F161 — Inicialização resiliente do Chromium no CI

Problema observado: a execução da RC33 falhou antes de rodar os testes de navegador porque a VM Ubuntu não conseguia resolver `azure.archive.ubuntu.com` ao executar `playwright install --with-deps chromium`. Não era falha dos testes do site.

A F161 baixa a versão de navegador travada no lockfile, tenta iniciar Chromium com as bibliotecas da imagem `ubuntu-24.04` e **somente se o launch falhar** instala dependências. O fallback ocorre exclusivamente no GitHub Actions descartável, trocando `azure.archive.ubuntu.com` por `archive.ubuntu.com` se necessário, e testa o Chromium novamente. Falha de dependência continua falhando o workflow; não há bypass de QA.

Ambos os workflows (Astro+SEO+Chromium e Lighthouse) compartilham o bootstrap. Nenhum deploy, mudança de VPS, DNS ou produção.
