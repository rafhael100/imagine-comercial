# Faísca R01 — evidência de desenvolvimento

> Atualização posterior: o titular autorizou publicar o mascote e os documentos R02 no GitHub público. Os relatos abaixo descrevem a rodada local anterior; autorização, preparação e validações de publicação estão em `AUTORIZACAO-PUBLICACAO-R02.md`. Essa atualização não altera resultados de testes nem concede merge/deploy.


Revisão de 17/11/2026, horário de São Paulo. Base examinada: `209bd893e741e7fd8d824d8e184471a86ee267ab`, Comercial #448. Este registro descreve verificações locais; não é homologação de produção.

## Executado e aprovado

| Verificação | Resultado observado |
|---|---|
| `npm test` | 1.074 testes aprovados, zero falhas, zero ignorados |
| Núcleo Faísca | 16 testes: jornadas, resumo, preços, pós-venda, credenciais, entradas inválidas e integridade da sessão |
| Build Faísca | 3 testes: imagem byte a byte, CSP exata, bundle válido, adulteração e import não permitido |
| Actions fixadas | 2 testes aprovados, incluindo o workflow específico novo |
| Dependências | `npm ci --no-audit --no-fund` concluído |
| Astro | `npm run build` concluído |
| Site compilado | `node scripts/verify-dist.mjs`: 63 páginas HTML e sitemap/robots; congelamento de coleta conferido em 75 arquivos HTML/JS |
| Sintaxe do QA | `node --check ops/faisca/browser-qa.mjs` aprovado |
| Workflow | YAML válido e actions na allowlist da base |
| Identidade | PNG 1.254 × 1.254, 1.887.660 bytes, SHA-256 `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d` |

Os 19 testes Faísca fazem parte dos 1.074 totais; não devem ser somados novamente. A suíte direcionada de núcleo, builder e políticas de Actions tem 21 testes.

## Revisão independente

A revisão encontrou e levou à correção de quatro problemas reproduzíveis: eco de credencial escrita naturalmente; comparação de canais confundida com comparação de formatos de site; prazo individual tratado como processo genérico; e bundler que removia import não autorizado antes do import permitido. As regressões passaram.

Também foram corrigidos o indicador do resumo no pós-venda, retornos antigos do clipboard e três pares de contraste textual. O QA agora inclui WCAG 2.1 A/AA e a guarda de rede no contexto sem JavaScript. Esses pontos da UI tiveram revisão de código; isso não substitui execução em navegador.

## Pendente ou bloqueado

- **Navegador local:** o Chromium não conseguiu iniciar no ambiente. O navegador compartilhado também recusou o protocolo de arquivo local por política de acesso. Nenhuma captura ou aprovação visual é alegada.
- **QA Faísca:** `ops/faisca/browser-qa.mjs` está preparado para ambiente autorizado com Chromium; cobre três jornadas, inputs sintéticos, reset, teclado, movimento, 320/390/1440 px, axe, ausência de persistência/rede e fallback sem JavaScript. Sua execução ainda precisa ocorrer.
- **CI remoto e auditor SEO independente:** não executados nesta entrega. A base tem histórico próprio, que não serve como resultado deste incremento. O novo workflow está apenas preparado; o fluxo geral existente não foi modificado.
- **Envio ao GitHub:** bloqueado pela revisão automática de autorização porque a imagem e os documentos seriam publicados em repositório público. Não há PR desta entrega nem merge ou deploy. O pacote local permite revisão e continuidade pelo Codex.

## Limites do produto entregue

Conversa determinística em memória, sem LLM, CRM, Portal, atendimento humano conectado ou voz. O movimento usa a imagem aprovada como um quadro; não existe malha ou rig 3D. O filtro de dados sensíveis é uma heurística auxiliar; não é uma garantia de detectar toda informação pessoal. A interface pública do Comercial permanece sem o widget.
