# F277 — Cobertura das 27 rotas legadas no corte de publicação

Antes de substituir o site antigo, a revisão precisa identificar individualmente o destino de **todas as rotas históricas conhecidas**, incluindo as que não têm serviço equivalente no novo catálogo.

## Posição inicial
- 5 rotas são **candidatas** a redirecionamento, sem 301 autorizado.
- 22 rotas estão em **HOLD**: não existe destino seguro homologado para elas.
- A decisão futura de host sem `www` não apaga as obrigações de preservar conteúdo, história da URL, idiomas, portfólio e páginas legais.

A API `reviewLegacyCutoverCoverage(decisions)` aceita apenas planos internos `retain-original`, `review-redirect` (exclusivo para candidata) e `pending`, exatamente um por rota quando disponível. Não permite `delete`, `approved`, alteração de destino ou inventário de URLs fora do catálogo.

`node scripts/report-launch-blockers.mjs` inclui o estado inicial como `legacyCutover`, com todas as 27 rotas pendentes de decisão. O retorno contém **somente contagens**, nunca libera 301, publicação ou retirada de conteúdo.

**Mesmo quando o operador registra 27/27 decisões, isso não comprova** preservação no servidor antigo, disponibilidade HTTP, equivalência editorial, segurança jurídica, hospedagem, robots/canonical ou aprovação independente.

## Para futura homologação
1. Consultar cobertura real de busca e URLs indexadas por fonte autorizada, mantendo métricas privadas fora dos repositórios públicos.
2. Para cada página antiga, definir preservação comprovável, substituição editorial compatível ou decisão formal de descontinuação; uma linha em HOLD não pode ser redirecionada automaticamente.
3. Testar com HTTP real em ambiente isolado cada combinação relevante de host e caminho, além de sitemap, canonicals, TLS, Search Console, períodos de transição, rollback e histórico de backlinks.
4. Obter revisões legal/LGPD/SEO e aprovação explícita de release antes de qualquer mudança em DNS, 301 ou `main`.

**NO-GO** é permanente enquanto não houver evidência operacional independente. Nenhum plano desse módulo cria arquivos `_redirects` ou altera o site publicado.
