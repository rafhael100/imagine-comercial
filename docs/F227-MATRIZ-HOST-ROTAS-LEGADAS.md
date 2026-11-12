# F227 — Cobertura integral de rotas na migração de host (staging offline)

A F225 fixou **sem www** como destino canônico. A F226 avaliou apenas as quatro raizes de host. A F227 evita que uma checagem da homepage esconda regressões de rotas.

`buildStagingHostRouteChecklist()` cria um checklist deterministico cobrindo **todas** as rotas editoriais atuais e os **27 caminhos legados** catalogados em quatro origens (http/https, raiz/www). Atualmente são 5 caminhos candidatos a equivalência e 22 HOLD. Não existe nenhum 301 aprovado para caminho legado.

- As rotas atuais sob HTTPS sem www devem dar 200, não ter Location, não ter noindex e apresentar TLS válido.
- As mesmas rotas sob outros hosts devem ter 301 direto para o caminho correspondente em HTTPS sem www; HTTPS com www exige TLS válido.
- **No staging de laboratório**, os 27 caminhos legados devem permanecer 404 com noindex, sem Location, inclusive os cinco candidatos. Este é um contrato de isolamento do staging, **não uma ordem para remover conteúdo do site antigo em produção**.
- `reviewStagingHostRouteObservations(rows)` só recebe inventário completo e exato. Entrada duplicada, caminho com query, host externo ou observação incompleta é negada. Divergências são reportadas sem reproduzir Location fornecido pelo operador.

A validação é feita por dados sinteticos e/ou capturados pelo operador fora do GitHub. Não executa requests, não cria arquivo `_redirects`, não prova a rede Leaseweb nem concede publicação. Evidências reais podem conter informações sensíveis; não registrá-las neste repositório público.

**Go-live continua NO-GO:** levantamento GSC/backlinks/crawl, equivalência editorial URL a URL, revisão juridica/idioma, staging privado real, segurança e consentimento, rollback, aprovação formal da migração e deploy são passos independentes.
