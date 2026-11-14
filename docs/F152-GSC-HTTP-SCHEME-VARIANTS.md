# F152 — Evidências HTTP/HTTPS separadas na migração GSC

## Correção funcional

Na análise de evidências de Search Console, o caminho `http://www...` e `https://www...` pode representar **duas URLs indexadas distintas**. Anteriormente, a deduplicação descartava a diferença de protocolo e os relatórios podiam confundir métricas das variantes ou rejeitar registros legítimos.

- `gsc-inventory-review`: inclui `observedHttp` na chave e mantém ambas as variantes; HTTP é `protocol_hold_for_manual_review`, sem destino proposto.
- `gsc-page-api-review`: reconcilia as métricas por protocolo e passa `observedHttp` ao revisor seguinte, mantendo linhas separadas.
- `host-canonical-review`: preserva a variante original, recusa campos forjados, cria `PROTOCOL_HOLD_REQUIRES_REVIEW` e adiciona `protocolHeld` ao sumário. Variantes HTTP não viram automaticamente redirecionamentos de host.
- `gsc-search-analytics-review`: mantém apenas caminhos e indicadores de esquema; continua descartando dados de desempenho GSC e parâmetros de URL.

## Riscos e bloqueios

Somente **fixtures sintéticas** em GitHub/CI. Nenhuma métrica real do GSC, consulta, token ou dado pessoal entra no repositório, log ou artifact. Proibição de `_redirects`, regras Cloudflare, DNS, deploy e merge `main`. A evidência não identifica automaticamente o destino de um 301: cada combinação protocolo, host e rota exige revisão de equivalência editorial, HTTP/canonical vivo e aprovação do release.

Validar `npm test`, build Astro, SEO, QA Chromium, Workerd e o revisor sintético antes de integrar na RC31.
