# F6 — Build reproduzível, navegador e acessibilidade

## Escopo do PR
- Dependências fixas Astro, Playwright Chromium e axe-core.
- Gerar uma única vez `package-lock.json` na **branch de trabalho**, nunca na `main`, por workflow limitado ao arquivo de lock; depois de criado, o CI usa somente `npm ci`.
- Testes reais contra `astro preview` local: carregamento e HTTP 200, H1, descrição, canonical, navegação interna, ausência de rolagem horizontal em mobile/desktop, erros de JavaScript e auditoria axe WCAG 2.1 A/AA em páginas selecionadas.
- Capturas visuais da homepage e serviço Landing Pages como artefatos do workflow para revisão humana.
- Auditor SEO independente permanece fixado por commit e bloqueia regressões do HTML compilado.

## Limites
- Não prova Core Web Vitals reais, ranking Google, visual design final ou conformidade legal completa.
- Capturas não equivalem a aprovação estética. Revisão de imagem, conteúdo comercial, portfólio e marca continua necessária antes de lançar.
- Sem consumo de credenciais reais, domínio alterado, integração financeira ou dados de clientes.
- Os workflows foram desenhados para runners públicos padrão, mas uso do GitHub Actions deve ser observado quanto a políticas da conta.
- A versão de navegador e dependências deve ser revisada em atualizações futuras; nenhum pacote vem de fonte fora do registro npm.

## Validação
```bash
npm ci
npm test
npm run build
node scripts/verify-dist.mjs
npx playwright install chromium
npm run test:browser
```

O workflow GitHub Actions utiliza `--with-deps` para instalar as dependências de Chromium no runner Ubuntu.
