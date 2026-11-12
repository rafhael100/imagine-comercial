# F221 — Quatro caminhos legados adicionais em HOLD

**Origem da descoberta:** consulta somente leitura do Search Console para a propriedade `sc-domain:imaginecomunicacao.com.br`, relatório de dimensão **page**, pesquisa web, últimos 16 meses com dados finalizados, consultado em 12/11/2026 por conexão autorizada. A lista contém apenas **caminhos públicos**, sem valores de cliques/impressões, consultas, dados pessoais, token, URLs com parâmetros ou detalhes da conta.

## Novos caminhos observados

- `/en-us/services/criacao-de-sites-institucional.html` — **HOLD**, sem política aprovada de idioma e equivalência de destino.
- `/en-us/services/youtube-ads-anuncios.html` — **HOLD**, serviço específico e versão em inglês sem destino adequado.
- `/o-que-fazemos/linkedin-business.html` — **HOLD**, conteúdo LinkedIn não deve ser deslocado para Meta/Google Ads.
- `/termos-de-uso.html` — **HOLD**, conteúdo jurídico exige preservação/revisão antes de mudança.

Inventário de caminhos passa de **23 para 27** (cinco candidatos não aprovados, vinte e dois HOLD). A homepage também foi observada em múltiplas variantes de esquema e host; **a escolha do host canônico é outro gate**, não resulta em 301 automaticamente.

**Limitações:** Search Console só retorna URLs com dados no período e não comprova catálogo completo, HTTP 200 atual, backlinks, equivalência editorial ou indexabilidade futura. Dados analíticos ficam fora do GitHub público; o relatório privado está na conversa, não neste commit.

**NO-GO:** nenhum caminho foi aprovado para redirect, migração, produção, Cloudflare, DNS, `main` ou publicação. Antes de decidir cada URL: crawl público com limites, matriz 1:1, conteúdo legal/idioma, revisão SEO/AppSec/LGPD, staging Leaseweb e autorização humana.
