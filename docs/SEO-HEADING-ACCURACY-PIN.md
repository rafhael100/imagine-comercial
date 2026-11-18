# Comercial — pin do auditor de H1 corrigido

**DRAFT / REVIEW ONLY / NO-MERGE / NO-DEPLOY / NO-DNS.**

O CI passa de `d5af3feb7af58a439b3ea778ccf45452d79e6b6b` para a revisão
imutável do SEO Engine `e0030209f032a1b95231d6bd208fbe84b06b2341`.
O workflow e os dois testes que conferem o pin permanecem sincronizados.
O registro da promoção anterior, em `SEO-NAVIGATION-ACCURACY-PIN.md`, permanece
como histórico daquela revisão.

## Correção incorporada

[Engine #318](https://github.com/rafhael100/imagine-seo-engine/pull/318) passa
a contar H1 pelo lexer já usado para âncoras e IDs. Exemplos literais de
`<h1>` em texto bruto, RCDATA e atributos entre aspas deixam de aprovar uma
página sem H1 real ou acusar duplicação numa página com um único H1.
A política existente continua exigindo exatamente um H1 real por rota,
com o mesmo diagnóstico `heading_count`.

As 14 regressões novas produziram oito falhas e seis controles aprovados
antes da correção; depois, os 14 casos e a suíte cumulativa de **1.057 testes**
passaram. A CI do Engine confirmou a revisão exata em **7/7 workflows e
11/11 jobs**, incluindo a suíte em Node 22 e 24. As correções anteriores de
links relativos, âncoras e IDs continuam incorporadas.

## Verificação local do consumidor

Base Comercial: `a5822f6d9b807d0ba8b6d43c89f9db4f6d646492`, da
[#449](https://github.com/rafhael100/imagine-comercial/pull/449).
Engine local confirmado na SHA exata acima, com árvore limpa.

| Verificação | Resultado |
|---|---|
| Testes de pin SEO e Actions imutáveis | 6/6 |
| Suíte `npm test` Comercial | 1.067/1.067, sem falhas ou skips |
| `npm ci --no-audit --no-fund` | Concluído antes do build |
| Build Astro | Concluído; 64 páginas, incluindo 404 |
| `node scripts/verify-dist.mjs` | 63 rotas públicas, sitemap e robots válidos |
| Auditor Engine no dist real | 63 páginas; zero erros e zero avisos |
| Grafo de navegação | 63 alcançáveis, zero órfãs, máximo 3 cliques |

Comando do auditor, preservado com suas quatro flags:

```bash
node ../imagine-seo-engine/scripts/audit-dist.mjs dist \
  https://imaginecomunicacao.com.br/ \
  --fail-on-warnings --strict-public-head --multilingual --check-hreflang
```

Todos os comandos locais terminaram com exit code 0 em Node 24.22.1. Os pins
das GitHub Actions e das capacidades Portal, as permissões e os gates do
workflow permanecem iguais. Chromium, Workerd e demais integrações remotas
devem ser conferidos na SHA final da PR Comercial.

A mudança promove o contrato corrigido do auditor; não afirma que as rotas
atuais continham exemplos falsamente interpretados como H1. O lexer não
reconstrói toda a árvore DOM nem a recuperação de HTML malformado de um
navegador. Os resultados não comprovam publicação, tráfego, OAuth/GSC real,
homologação da VPS ou liberação de checkout.
