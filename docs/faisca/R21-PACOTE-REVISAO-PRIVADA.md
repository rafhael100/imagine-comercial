# Faísca R21 — pacote verificável de demonstração para revisão

**Contexto:** complemento de homologação de laboratório da cadeia R02–R20. Base R20, [PR #483](https://github.com/rafhael100/imagine-comercial/pull/483), SHA `de285aab16eb03f824514bbe3839f510d318813d`.

## Objetivo

Facilitar a inspeção do Faísca sem confundir teste e operação. A CI já compilava as páginas Astro em separado, mas seus resultados não eram entregues como pacote navegável para revisão funcional. A R21 fornece dois formatos **distintos**:

- **`Faisca_Demonstracao_Guiada.html`** — um único arquivo para abrir no navegador, inteiramente offline, com mascote e **conversa guiada inicial R02**. Não possui os recursos completos R08–R20 nem PHP.
- **`astro/`** — as sete páginas compiladas de laboratório com interfaces R02–R20, incluindo qualificação, pós-venda e versões HTTP. As rotas HTTP **não** funcionam integralmente sem o servidor loopback Node/PHP e o checkout Agents pinado. Não executar essas rotas em hospedagem pública.

A ideia é facilitar revisão visual e de navegação, não declarar que existe Faísca em produção.

## Controles de integridade e publicação

O auditor `ops/faisca/review/build-review.mjs` só roda com `IMAGINE_FAISCA_LAB=1` e recusa:
- alteração do PNG original aprovado, conferido por SHA-256 em cada página;
- ausência de qualquer das sete páginas esperadas;
- HTML sem `noindex,nofollow,noarchive`, sem `referrer=no-referrer` ou sem idioma PT-BR;
- arquivos/diretórios não permitidos, symlinks, arquivos com mais de 8 MiB, mais de 64 arquivos ou conjunto superior a 24 MiB;
- divergência entre o PNG do demonstrativo único e o do laboratório.

O manifesto `Faisca_R21_AUDIT.json` registra tamanho e SHA-256 de cada arquivo, sem transcrições. Inclui `scope=offline_private_review_only`, `productionPublished=false`, `checkoutEnabled=false` e `externalModelEnabled=false`.

## CI e acesso ao pacote

O workflow [Faísca — demonstração guiada e acessibilidade](https://github.com/rafhael100/imagine-comercial/actions/workflows/faisca-guided-lab.yml) só envia o artifact **`faisca-R21-PRIVATE-REVIEW-ONLY`** quando os testes, o build, a auditoria e o navegador terminam sem falhas.

Para obter o pacote: abrir a execução correspondente à SHA aprovada da PR, baixar o artifact na seção **Artifacts**, extrair o ZIP e abrir `Faisca_Demonstracao_Guiada.html`. O arquivo `LEIA-ME-FAISCA-R21.txt` explica a diferença entre o demonstrativo offline e as sete páginas que dependem do servidor. Retenção da CI: sete dias.

Reprodução em checkout isolado:

```bash
npm ci --no-audit --no-fund
node --test tests/faisca-r21-review-bundle.test.mjs
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
IMAGINE_FAISCA_LAB=1 node ops/faisca/review/build-review.mjs --private-review
```

Os testes negativos validam recusa de HTML indexável, PNG adulterado, arquivo não autorizado, symlink e estrutura incompleta. Os demais testes de QA/Chromium e da ponte PHP continuam nos respectivos workflows fixados por SHA.

## Limitações e gates

- O artifact é **somente revisão**, não uma URL de produção nem um pacote liberado para deploy.
- O demonstrativo único não contém uma IA generativa nem representa o fluxo completo pós-venda/checkout; não promete modelo externo ou CRM.
- O laboratório tem HTML `noindex`, mas **esse metadado não é controle de autenticação**. Não enviar a pasta a CDN ou host aberto. A homologação privada precisa de acesso restrito/HTTPS, backup, rollback e evidência de operação.
- Site público, mascote, DNS, Cloudflare, VPS, `main`, CRM, Portal e PSP não são alterados.
- Não houve gasto, uso de dados reais ou criação de credenciais.

**Próximo gate:** revisão independente de R07–R21 e integração do serviço real do Portal (p.ex. [Portal #669](https://github.com/rafhael100/imagine-portal/issues/669)), sem substituir pedido/briefing persistidos por uma simulação HTML.
