# Codex — estado R03 e próxima fronteira de servidor R04

17/11/2026, America/Sao_Paulo. Projeto Faísca, prioridade Imagine Comercial. Preservar o modelo visual aprovado. Atividade: [Comercial #444](https://github.com/rafhael100/imagine-comercial/issues/444).

## Estado atual que deve ser reaproveitado

A R02 foi publicada na [PR #452](https://github.com/rafhael100/imagine-comercial/pull/452), SHA `c833c12ff34aaeba56549ae5dc41763a6a909b2a`. Seus três workflows terminaram aprovados, incluindo os testes de navegador que antes estavam bloqueados localmente.

A R03 desta branch implementa:

- schemas fechados de entrada e resposta, com correlação e fontes versionadas;
- runtime volátil com SHA-256 canônico, deduplicação, conflito, capacidade fixa, cancelamento e conciliação;
- cinco cenários de provedor simulado e ancoragem integral ao candidato editorial;
- integração assíncrona no laboratório Astro, reset/desmontagem e fallback;
- testes de contrato, runtime, carregamento, navegador, acessibilidade e isolamento público.

Leia `CONTRATO-CONVERSA-R03.md` e `VALIDACAO-R03.md` antes de iniciar. Não reconstruir o widget, regenerar o mascote ou repetir R03 como pendente. A demonstração standalone permanece guiada. A conversa de laboratório não chama IA externa.

## Próximo recorte: fronteira de servidor em laboratório

O próximo objetivo é exercitar o transporte e o contexto confiável que futuramente receberão o chat. Faça primeiro um ensaio isolado, preservando o contrato R03 e os limites operacionais.

1. Revalidar HEADs e instruções no Comercial e no Agents. Criar branch própria a partir da dependência correspondente, sem combinar frentes automaticamente.
2. Revisar o ponto de adaptação de `AiSuggestionProvider`, o contexto versionado e a governança existentes no Agents. O receiver da Central recebe eventos CRM privados; não o transformar em endpoint de browser.
3. Especificar a sessão pública de conversa separada de uma sessão de cliente autenticado. Empresa, usuário, serviço e permissões devem ser determinados pelo servidor quando houver contexto autenticado. IDs do visitante nunca concedem acesso.
4. Exercitar request/response por transporte de laboratório em loopback, usando somente fixtures sintéticas e provedor simulado. A configuração do servidor define fontes, ações, timeouts e limites.
5. Reutilizar mecanismos de reserva/idempotência do Agents quando aplicáveis; testar concorrência e resposta incerta sem repetir chamadas. Os registros em memória do browser não são a solução persistente.
6. Testar origem/escopo recusados, schema inválido, correlação errada, cancelamento, timeout, reconciliação, limite e indisponibilidade. Comparar o resultado com o fallback do Comercial.
7. Antes de sugerir conexão a modelo real, documentar fonte oficial, política de resposta, custo, retenção, operação e observabilidade. Não retirar a ancoragem do simulador para converter a demonstração em IA operacional.
8. Entregar código, testes, revisão independente e PR draft com evidências na SHA exata. Atualizar o relatório do que foi implementado, validado e efetivamente integrado.

## Referências de reuso já consultadas

| Linha | HEAD examinado |
|---|---|
| [Agents P65 #471](https://github.com/rafhael100/imagine-ai-agents/pull/471) | `740abafc813dbde70f5a2ad6e138402ed7945276` |
| [Central #472](https://github.com/rafhael100/imagine-ai-agents/pull/472) | `8e7f1f21a2927bde3e337edaace0e1e6dffdc29a` |

`AiSuggestionProvider` fornece sugestões sem autoridade. `SupervisedCoordinator` separa sugestão e efeito. `MockKnowledgeRetriever` e `MockContextEnvelope` revalidam fonte/contexto. `MockUsageLedger` é volátil. Laboratórios PostgreSQL mantêm seus guards e não devem ser executados em ambiente persistente.

## Validação e preservação

Preservar PNG/hash, template do mascote, estilos aprovados, jornadas e fontes editoriais existentes. Manter laboratório fora de `src/pages`, `public`, sitemap e dist público. Não afrouxar F31/F32, allowlists, pins de CI ou proteções para encaixar a integração.

A continuidade de desenvolvimento e a publicação de código/documentação em branches de revisão estão autorizadas. A autorização não converte a PR em merge/deploy e não introduz despesas, dados reais ou operação na VPS/DNS. Avançar nas tarefas de laboratório já possíveis e registrar impedimentos concretos quando encontrados.
