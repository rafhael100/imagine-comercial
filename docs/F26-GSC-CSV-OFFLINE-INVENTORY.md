# F26 — Auditoria offline de exportação Google Search Console (GSC)

Data: 09/11/2026. **Somente revisão, sem deploy e sem acesso à conta Google.**

## Finalidade

O inventário legado atual possui apenas URLs conhecidas de pesquisas públicas e navegação do site antigo. Sem exportação GSC e crawl completo, não é possível aprovar a migração SEO de forma confiável. A F26 cria a ferramenta de importação local para classificar o que a exportação contiver, sem ativar ou sequer produzir regras 301.

## Como usar

No desenvolvimento, executar `npm test` e `node scripts/review-gsc-inventory.mjs --synthetic`. O arquivo de exemplo em `tests/fixtures/gsc-synthetic-pages.csv` tem dados **100% inventados**: ele é apropriado para CI.

Após receber exportação oficial de **Desempenho → Páginas** do Search Console (CSV), executá-la apenas em ambiente privado, por exemplo:

```bash
node scripts/review-gsc-inventory.mjs --file /caminho/privado/Pages.csv
```

A ferramenta lê o CSV do disco, sem realizar requisição externa. Os relatórios são gravados em `artifacts/gsc-review/`, pasta ignorada pelo Git. Os artefatos da CI **sempre** vêm do CSV sintético. **Nunca** subir CSV real ou relatórios privados de GSC a uma branch pública ou a artifacts do GitHub.

## Regras de revisão

- Aceita exportações CSV em português ou inglês, incluindo separação por vírgula e ponto e vírgula, BOM e campos entre aspas.
- Recusa URL de domínio estrangeiro, URL com usuário/senha e esquema inseguro; aceita apenas o domínio oficial e `www`.
- Mantém o host observado e classifica caminhos por inventário legado, conteúdo publicado atualmente, HOLD e URLs desconhecidas.
- URLs com parâmetros, fragmentos ou segmentos codificados são separadas como **variante HOLD**. Não imprime nem persiste parâmetros, que podem transportar dados pessoais e tokens.
- Compara o conjunto observado ao inventário conhecido e identifica caminhos ainda ausentes. A ausência em uma exportação **não prova** que uma URL antiga nunca existiu.
- Nunca transforma `candidate` em `approved`; a saída registra proposta de destino apenas como hipótese que precisa de equivalência editorial, Search Console, crawl e aprovação humana.
- Limites: entrada de 2 MiB, 10 mil registros, 12 colunas e 4 KiB por campo.

## Limitações e gates

Uma exportação `Pages.csv` não substitui sitemap histórico, rastreamento do domínio com variações de host, backlinks, páginas não indexadas, conteúdo legal/privacidade, arquivos e parâmetros. A auditoria **não se conecta ao Search Console** e não declara cobertura completa até serem fornecidos dados oficiais, crawler e revisão.

Antes de qualquer regra 301 em produção: aprovação de cada par origem/destino, verificação do conteúdo equivalente, lista de HOLD, gestão de idiomas, tratamento dos termos e portfólio, homologação de canonical/sitemap/404/redirects no staging, aprovação humana separada e procedimento de rollback.

Nenhuma mudança em `main`, DNS, Cloudflare, redirecionamentos ativos, fornecedor pago ou cliente foi feita por esta fase.
