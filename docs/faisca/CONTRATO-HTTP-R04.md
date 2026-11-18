# Faísca R04 — fronteira HTTP de laboratório

17/11/2026, America/Sao_Paulo. Base: [R03 #453](https://github.com/rafhael100/imagine-comercial/pull/453), SHA `7baf105b3601774b62c3492340e552300caf5e5b`. Branch: `feat/faisca-r04-loopback-conversation-2026-11-17`.

## Objetivo e fronteira

Exercitar HTTP real com contexto definido pelo servidor e tratamento correto de respostas incertas. O servidor importa o runtime R03; não duplica o motor. O provedor determinístico devolve apenas o candidato editorial exato, sem retirar a ancoragem para alegar uma integração com IA.

A entrada continua `faisca.conversation.v1`, com conversa, mensagem, `locale: pt-BR` e apenas texto ou ação. A resposta continua `faisca.response.v1`, correlacionada e limitada às fontes/ações permitidas. A versão editorial passa a `faisca-editorial-2` para registrar os avisos de transporte corrigidos: textos compartilhados não afirmam ausência de envio quando existe HTTP loopback.

O laboratório tem duas páginas isoladas: `/` mantém o simulador do browser e `/http/` usa HTTP. Nenhuma integra as rotas públicas do Comercial.

## Sessão e autoridade

O processo emite um ID de conversa aleatório de 16 bytes e um token de 32 bytes, codificados em hexadecimal. Guarda a sessão pelo SHA-256 do token e fixa o contexto:

```json
{
  "scope": "public_comercial",
  "knowledgeVersion": "faisca-editorial-2",
  "provider": "simulated",
  "operationalEffects": false
}
```

O token permite acessar somente a conversa sintética correspondente. Não identifica cliente nem concede tenant, role, preço, ferramenta ou permissão. Campos extras de autoridade são recusados. O visitante não determina provedor, conhecimento ou endpoint.

O token fica em memória do cliente, fora de DOM, cookies, URLs, `localStorage` e `sessionStorage`. O servidor não registra texto ou credenciais em logs. `inspect()` retorna contadores, nunca tokens, IDs de conversa ou conteúdo.

## Rotas

Todas as rotas exigem `Origin` igual ao servidor e `Host` exato. JSON usa `Content-Type: application/json`, opcionalmente `charset=utf-8`, e tamanho explícito. Não há CORS permissivo ou confiança em `X-Forwarded-*`.

| Método e rota | Corpo | Credencial | Resultado |
|---|---|---|---|
| `POST /__faisca_lab/sessions` | `{}` | Nenhuma | `201`, schema `faisca.http.session.v1`, conversa, token, `expiresInMs` e contexto fixo |
| `POST /__faisca_lab/messages` | Envelope R03 | `Authorization: Bearer <token>` | `200`, schema `faisca.http.result.v1` com resultado do runtime |
| `POST /__faisca_lab/reconcile` | Mesmo envelope R03 | Mesmo token | `200`, consulta ao registro, sem despacho ao provedor |
| `DELETE /__faisca_lab/session` | `{}` | Token da sessão | `204`, descarte da sessão sintética |

O resultado HTTP contém somente `schema`, `status`, `delivery`, `accepted`, `reason` e `response`. O cliente verifica schema fechado, correlação, versão editorial, fontes, ações e consistência entre aceitação e entrega antes de apresentar o resultado.

Estados do runtime, incluindo conflito, limite e desconhecido, ficam no envelope `200`. Erros HTTP usam `faisca.http.error.v1` com código fechado, sem ecoar a entrada: `400` para schema/framing, `401` para sessão inválida/expirada, `403` para origem/conversa alheia, `413` para tamanho, `415` para tipo/encoding, `408` para leitura lenta e `429` para capacidade de sessões.

A sessão é revalidada antes da leitura, depois do corpo e depois de aguardar o runtime, antes da entrega. Expiração ou revogação nesses intervalos impede entrega tardia sob a credencial antiga. `401` após despacho não prova que a mensagem nunca foi processada.

## Deduplicação e resultado incerto

O servidor reaproveita a chave de conversa/mensagem e o fingerprint SHA-256 canônico R03. Chamadas simultâneas idênticas compartilham o envio. Mesmo ID com outro conteúdo retorna conflito. Capacidade esgotada não remove registros para permitir replay como novo envio.

Depois do despacho, timeout ou desconexão não equivale a cancelamento anterior ao envio. O resultado inicial `unknown` permanece estável em `send`; somente `reconcile` revela o resultado final tardio. Fechar um socket HTTP não destrói a sessão nem dispara outra chamada.

Na UI HTTP, `unknown`, resposta inválida ou resposta HTTP perdida mantém **a promessa do turno original pendente**. A conversa não avança o resumo nem permite outra mensagem. A consulta manual usa o mesmo corpo/token, sem outro POST de mensagem. Uma resposta final validada resolve o turno original uma vez. `not_found` também não autoriza reenvio automático: pode anteceder o término de um processamento concorrente.

Reinício/desmontagem invalidam a geração, abortam esperas locais e tentam excluir a sessão. Respostas antigas não ressuscitam a conversa. Uma criação identificada depois do reinício recebe tentativa de exclusão; uma criação cuja resposta se perde expira pelo TTL. Recarregar perde o token e não comprova cancelamento de trabalho recebido.

## Limites

| Recurso | Padrão ou limite |
|---|---|
| Bind | Somente `127.0.0.1` |
| Porta CLI / QA | `4330` / efêmera |
| Sessões | 8 por padrão; configuração confiável até 32 |
| TTL | 300.000 ms, sem renovação automática |
| Mensagens registradas | 64 por sessão; configuração até 256 |
| Corpo JSON | Máximo 8.192 bytes |
| Leitura do corpo | 1.000 ms |
| Espera do runtime | 250 ms |
| Espera HTTP do cliente | 2.500 ms |
| Resposta lida pelo cliente | Máximo 16.384 bytes |
| Conexões | Máximo 32; keep-alive de 1.000 ms |
| Atraso normal / timeout na CLI | 40 ms / 800 ms |

Testes podem injetar relógio, provedor simulado e limites menores por código confiável. A requisição não controla essas opções. Não há banco, idempotência distribuída, rate limit operacional, reserva de custo ou proteção financeira.

O snapshot estático só aceita os dois HTML e arquivos `_astro/*.js|css` regulares, com limites de tamanho e quantidade. Symlinks, diretórios inesperados, traversal, encoding e query em paths são recusados. Respostas incluem `no-store`, `noindex`, `nosniff`, política de referrer e CSP restrita.

## Privacidade e apresentação

Antes de criar sessão, o cliente reutiliza `core.respond` para recusar padrões sensíveis e instruções de autoridade. Esses casos recebem orientação local sem HTTP. O servidor repete a política para chamadas diretas. A detecção é heurística; use somente conteúdo fictício.

Boas-vindas, privacidade, atendimento humano e resumo foram corrigidos para permanecer verdadeiros nos três modos. O fragmento HTTP explica os registros temporários. A imagem, o template base, `styles.css` e `ui.mjs` permanecem preservados; não há alteração visual do mascote.

## Reuso do Imagine Agents

Revalidados [Agents #471](https://github.com/rafhael100/imagine-ai-agents/pull/471), HEAD `740abafc813dbde70f5a2ad6e138402ed7945276`, e [Central #472](https://github.com/rafhael100/imagine-ai-agents/pull/472), HEAD `8e7f1f21a2927bde3e337edaace0e1e6dffdc29a`. Não foi encontrado ingresso de chat pronto ou outra frente Faísca R04 publicada.

- [AiSuggestionProvider](https://github.com/rafhael100/imagine-ai-agents/blob/740abafc813dbde70f5a2ad6e138402ed7945276/src/Contracts/AiSuggestionProvider.php) é uma interface interna de sugestão, sem sessão HTTP de browser.
- [SupervisedCoordinator](https://github.com/rafhael100/imagine-ai-agents/blob/740abafc813dbde70f5a2ad6e138402ed7945276/src/MockOrchestration/SupervisedCoordinator.php) separa sugestão de efeito e não repete despacho incerto.
- [MockContextEnvelope](https://github.com/rafhael100/imagine-ai-agents/blob/740abafc813dbde70f5a2ad6e138402ed7945276/src/MockKnowledge/MockContextEnvelope.php) orienta revalidação de contexto/fonte, sem conceder autoridade operacional à fixture.
- [MockSyntheticHttpEnvelope](https://github.com/rafhael100/imagine-ai-agents/blob/740abafc813dbde70f5a2ad6e138402ed7945276/src/MockBridge/MockSyntheticHttpEnvelope.php) monta dados inertes; não fornece socket ou dispatcher de chat.
- O [receiver Central](https://github.com/rafhael100/imagine-ai-agents/blob/8e7f1f21a2927bde3e337edaace0e1e6dffdc29a/runtime/central-auto/index.php) recebe eventos CRM privados sob mTLS. Não foi convertido em API de navegador.

A R04 reutiliza código R03 no servidor e invariantes do Agents. **Não executa PHP Agents e não comprova integração com ele.** O próximo recorte deve definir essa ponte explicitamente, mantendo guards PostgreSQL, contexto confiável e separação de efeitos.
