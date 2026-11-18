# Faísca R04 — evidências de implementação e validação

17/11/2026, America/Sao_Paulo. Base: [R03 #453](https://github.com/rafhael100/imagine-comercial/pull/453), SHA `7baf105b3601774b62c3492340e552300caf5e5b`. Branch: `feat/faisca-r04-loopback-conversation-2026-11-17`.

## Entrega

Transporte HTTP real entre browser e servidor em loopback, com sessão emitida pelo servidor, contexto público fixo, autorização vinculada à conversa, limites e expiração. O servidor reutiliza o runtime R03 e seu provedor simulado. A UI consulta uma mensagem incerta sem reenviá-la e só conclui o turno original depois de resultado final validado.

A continuidade foi aprovada pelo titular após a R03. Código, documentos e workflow seguem em branch própria e PR draft. Esta entrega não executa PHP Agents, LLM, CRM, Portal ou operação na VPS. O site público não recebeu o chat.

## Verificações locais executadas

| Verificação | Resultado observado |
|---|---|
| Dependências fixadas | `npm ci --no-audit --no-fund` concluído |
| Suíte completa Comercial | **1.169/1.169**, zero falhas, cancelamentos ou skips |
| Testes Faísca incluídos | **97**: 60 anteriores + 21 HTTP servidor + 16 contrato/cliente HTTP |
| HTTP servidor | **21/21**, com sockets reais em `127.0.0.1` e fixtures sintéticas |
| Contrato/cliente HTTP | **16/16**, incluindo respostas perdidas, adulteradas, grandes e tardias |
| Build Astro isolado | Concluído; exatamente `/index.html` e `/http/index.html` |
| Navegador standalone | **22/22** |
| Navegador Astro R03 | **15/15** |
| Navegador HTTP R04 | **15/15** |
| Total navegador | **52/52**, com axe em 320, 390 e 1440 px nos três modos |
| Erros, requisições inesperadas e persistência | Nenhum observado nos cenários de navegador executados |
| Encerramento dos servidores do QA HTTP | Oito instâncias com `live=false`, sessões, sockets e requisições em curso zerados |
| CLI explícita | Página `/http/` retornou `200`/noindex; SIGTERM encerrou com código0 |
| Build público | 64 páginas geradas, correspondendo a 63 rotas editoriais + 404 |
| Verificador público | `verify-dist.mjs` aprovado; freeze de intake, HTML, sitemap e robots preservados |
| Comparação pública antes/depois | **85/85 arquivos idênticos**, zero diferenças |

A suíte completa e o build final foram executados após as correções de expiração na entrega e classificação de `401` no cliente. Os QA HTTP e Astro foram repetidos sobre o build final. O standalone também foi verificado com os textos e metadados R04.

Os relatórios gerados ficam fora das fontes versionadas: `report.json`, `astro-report.json` e `Faisca_HTTP_R04_BROWSER_QA.json`, em `ops/faisca/reports/`. Os relatórios Astro/HTTP registram `browser: EXECUTED` e `axe: EXECUTED`. O relatório standalone herdado usa `STARTED`/`ATTEMPTED` nos campos globais; seus 22 resultados individuais, incluindo axe, estão aprovados.

O workflow Faísca recebeu somente uma etapa adicional de QA HTTP, preservando Actions pinadas, permissões e retenção existentes. Os resultados remotos devem ser conferidos na SHA efetivamente recebida pelo GitHub. A descrição da PR reúne os links das execuções; aprovação local não substitui esse resultado.

## Riscos concretos exercitados

- Host/Origin ausentes, nulos, externos ou duplicados; método, framing, tipo e encoding inválidos; corpo excessivo ou lento; JSON inválido; traversal e arquivos estáticos inesperados.
- Token inválido/expirado, conversa alheia, campos extras de autoridade, contexto/versionamento adulterado e schema não correlacionado.
- Expiração durante a leitura parcial do corpo: `401` e zero dispatches. Expiração depois do despacho e antes da entrega: `401`, resposta não entregue e um único dispatch.
- Envio concorrente idêntico, replay, conflito com outro conteúdo, capacidade de sessões/mensagens e descarte explícito.
- Timeout, socket desconectado e resposta HTTP perdida: nenhuma repetição automática; consulta da mensagem original sem despacho adicional.
- Resposta `not_found` não libera reenvio automático. Sessão expirada não é recriada silenciosamente.
- Resposta HTTP grande, inválida ou de outra mensagem não chega à UI como orientação confirmada.
- Entrada sensível ou instrução de autoridade é recusada localmente antes de criar sessão. A política do servidor também evita encaminhamento ao provedor em chamadas diretas.
- Reset durante criação ou envio, criação tardia, desmontagem e reconciliação não reativam uma geração antiga.
- Tokens não aparecem no DOM, em cookies ou no armazenamento do browser. As evidências usam somente dados sintéticos e contadores.

## Revisão independente e correções

Uma revisão separada examinou contrato HTTP, cliente, servidor, testes e documentação. Um ensaio próprio confirmou uma única mensagem enviada, conciliação com corpo/token iguais e bloqueio sensível antes da rede. A revisão final não encontrou bloqueios concretos para o escopo de laboratório.

Durante a implementação, a checagem de sessão foi reforçada após o `await` do runtime, antes de entregar resposta. O cliente passou a tratar `401` posterior ao despacho como encerramento da sessão, sem declarar que a mensagem nunca executou. Testes com relógio injetado e provedor adiado confirmaram essas fronteiras.

Também foram corrigidas frases herdadas da demonstração totalmente local que afirmavam ausência de qualquer envio. Os textos agora distinguem o resumo não enviado à equipe e o transporte HTTP local. A revisão editorial recebeu a versão `faisca-editorial-2`.

Essa revisão é de código e laboratório. Não certifica endpoint público, LGPD operacional, autenticação de cliente, proteção financeira ou prontidão de produção.

## Integridade

- PNG: `ops/faisca/assets/faisca-master.png`, 1.887.660 bytes, 1254 ×1254 pixels.
- SHA-256: `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`.
- PNG, `demo.template.html`, `styles.css`, `ui.mjs` e `conversation-runtime.mjs` idênticos à base R03.
- `src/pages`, `public`, layout público, catálogo e pins de CI preservados.
- A nova página e os controles HTTP pertencem somente ao laboratório isolado.

## Continuidade

O próximo recorte é uma ponte explícita de conversa com Imagine Agents, conforme `CODEX-PROXIMA-ENTREGA.md`. A R04 já comprova transporte HTTP local, mas não uma ligação ao runtime PHP. Persistência, identidade real, fontes operacionais, governança de uso e provedor externo continuam pendências distintas. Nenhum teste autoriza merge, deploy ou alterações de infraestrutura.
