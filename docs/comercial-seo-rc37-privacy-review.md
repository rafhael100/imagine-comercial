# Imagine Comercial × SEO RC37 — Auditoria estática e privacidade do handoff

Este lote adiciona **somente testes e documentação**, sem alterar o motor pinado na CI oficial do Comercial. O workflow `commercial-seo-rc37-privacy-review.yml` compara a versão pinada em revisão no Comercial, [SEO RC36 #124](https://github.com/rafhael100/imagine-seo-engine/pull/124) (`440d515c1094ed5c8e0094c5c614fe1d6d49d881`), com a candidata [SEO RC37 #127](https://github.com/rafhael100/imagine-seo-engine/pull/127) (`872261657d9fc9aa62a6316942709025dae5abd6`).

## Provas automáticas

1. Checkouts independentes dos SHAs **exatos**, sem persistência de credenciais, e leitura de `git rev-parse HEAD`.
2. Suíte completa de testes SEO RC37 em Node 22.
3. Compilação Astro do Comercial, `verify-dist.mjs` e auditorias estáticas **idênticas** nos dois motores sobre o mesmo diretório `dist` (sumário, inventário de rotas, erros e avisos).
4. Duas exportações fictícias com uma consulta CPF formatado ocultada em período anterior e queda em tema público: o resumo legado da RC36 ainda produz números orgânicos; na RC37, F87 exige `organic=null`, preserva apenas ação técnica `repair_canonical`.
5. O contrato F86, recalculado dos mesmos dados originais, esconde totais e todos os sinais; o handoff para Portal recebe apenas ação técnica, permissões falsas, sem termos/CPF/nomes de arquivo ou mensagens privadas.

A transição não autentica dados Google e **não** habilita relatório real de cliente, tenant, OAuth, banco ou publicação. Todo o QA utiliza identificadores e métricas sintéticos.

**NO-GO:** nenhum merge em `main`, novo pin no workflow oficial, deploy, DNS, 301, alteração de campanha ou custo. Para futura promoção da RC37: CI do lote e auditoria independente AppSec/SEO/LGPD, homologação de staging e PR específica do pin com rollback e aceite de release.
