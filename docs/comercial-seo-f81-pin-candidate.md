# Comercial SEO-F81 — Candidata de atualização do auditor pinado

**Origem:** [PR #233](https://github.com/rafhael100/imagine-comercial/pull/233), que comparou com sucesso o auditor original (`bbcc198b5eb88585534c0a0374ed8c787f40e7ca`) e a nova revisão SEO-F81 (`10a649f9c448fe8412da6e8c499eec0637d9259e`) sobre a **mesma compilação** do site, com igualdade de resultados de HTML, rotas, avisos e erros.

## Alteração candidata

- Em `.github/workflows/validate.yml`, o SHA do checkout do auditor SEO foi atualizado **apenas nesta branch de revisão** para `10a649f9c448fe8412da6e8c499eec0637d9259e`.
- Um passo adicional do CI compara `git rev-parse HEAD` com o commit esperado e verifica ausência de alterações em arquivos versionados no checkout do motor.
- O workflow original do Comercial continua compilando o Astro, executando sua suíte de testes, auditando o HTML com `--fail-on-warnings --strict-public-head`, verificando o site compilado e realizando QA de navegador; o motor SEO F81 também executa seus testes `npm test` no CI.
- O workflow de **comparação histórica** da PR #233 não foi removido; ele intencionalmente mantém o pin antigo e o F81 para detectar regressões futuras no mesmo build.

## Risco e reversão

Se a atualização ocasionar problema, reverta **somente** o `ref:` do checkout em `validate.yml` para `bbcc198b5eb88585534c0a0374ed8c787f40e7ca` e remova/atualize a verificação de commit associada em um novo PR; não é necessário reverter páginas, domínios, banco ou dados de clientes porque essa mudança controla apenas a versão de QA offline.

**NO-GO:** nenhuma mudança foi aplicada à `main`, nenhum deploy, DNS, redirecionamento ou dado Google real. A promoção requer que o CI desta candidata seja aprovado, revisão independente de segurança/SEO e aceite da release do Comercial. Não confundir o fato de estar pinado em revisão com uma atualização operacional.
