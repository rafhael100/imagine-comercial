# Codex — estado R04 e próxima ponte com Imagine Agents

17/11/2026, America/Sao_Paulo. Projeto Faísca, prioridade Imagine Comercial. Atividade: [#444](https://github.com/rafhael100/imagine-comercial/issues/444). Preservar integralmente a imagem aprovada.

## Trabalho concluído que deve ser reaproveitado

- [R02 #452](https://github.com/rafhael100/imagine-comercial/pull/452), SHA `c833c12ff34aaeba56549ae5dc41763a6a909b2a`: mascote, demo guiada, ciclo de vida, Astro e acessibilidade.
- [R03 #453](https://github.com/rafhael100/imagine-comercial/pull/453), SHA `7baf105b3601774b62c3492340e552300caf5e5b`: contrato fechado, simulador, deduplicação, resposta incerta e conciliação. Os três workflows dessa SHA foram aprovados.
- **R04 desta branch**, `feat/faisca-r04-loopback-conversation-2026-11-17`: HTTP real em loopback, sessão/contexto emitidos pelo servidor, vínculo da conversa, limites, expiração, cliente sem persistência e consulta manual sem redispatch. Reutiliza o runtime R03 no servidor.

Leia `CONTRATO-HTTP-R04.md`, `VALIDACAO-R04.md` e `ops/faisca/README.md`. A R04 não conecta PHP Agents ou modelo externo. Não repetir HTTP como pendente nem reconstruir a UI. A versão editorial atual é `faisca-editorial-2`, com textos compatíveis com os três modos de transporte.

## Próximo recorte R05: ponte explícita com Agents

Exercitar uma fronteira real entre o chat e um componente Agents, ainda com conteúdo sintético e provedor sem custo. Antes de implementar, revalidar HEADs, contratos e instruções nos dois repositórios, evitando frente concorrente.

1. Definir ingresso de conversa pública no Agents, separado de sessão autenticada de cliente. ID/token de laboratório não concede tenant, ferramentas ou acesso ao Portal.
2. Mapear o contrato Faísca para um adaptador revisável no Agents, reaproveitando contratos/coordenadores quando compatíveis. Não apresentar import nominal, fixture ou envelope inerte como integração executada.
3. Exercitar ciclo entre processos com fixture sintética, correlação e versão de contexto/fonte conferidas nos dois lados. Manter provedor determinístico enquanto política de grounding, retenção, orçamento e identidade não estiver definida.
4. Preservar reserva, despacho, incerteza e conciliação existentes. Testar perda de resposta, versão incompatível, revogação, conflito e indisponibilidade sem reenvio automático; explicar quais registros ainda são voláteis.
5. Definir fontes comerciais e FAQ permitidas. Preços, descontos, contratos, checkout e situação do cliente continuam sob autoridade do Portal e fontes homologadas.
6. Documentar a passagem futura para modelo real: fonte oficial, custo/limite de uso, dados, retenção, observabilidade e indisponibilidade. Não introduzir chamadas pagas ou dados reais como prova de laboratório.
7. Publicar implementação, contratos e evidências em branches isoladas e PRs draft, preservando dependências. Validar na SHA efetivamente recebida pelos workflows.

## Referências revalidadas na R04

| Frente | HEAD examinado |
|---|---|
| [Agents P65 #471](https://github.com/rafhael100/imagine-ai-agents/pull/471) | `740abafc813dbde70f5a2ad6e138402ed7945276` |
| [Central #472](https://github.com/rafhael100/imagine-ai-agents/pull/472) | `8e7f1f21a2927bde3e337edaace0e1e6dffdc29a` |

`AiSuggestionProvider` fornece sugestões, sem API de conversa. `MockSyntheticHttpEnvelope` é inerte. O receiver Central é privado/mTLS para eventos CRM, separado do browser. Laboratórios PostgreSQL conservam guards de CI descartável: não aplicar migrações em banco persistente ou simular variáveis de CI para execução local.

## Preservação e autorização

Hash aprovado do PNG: `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`. Preservar imagem, recorte, cores, template base, estilos e jornadas. Manter laboratório fora de `src/pages`, `public`, sitemap e dist público. Não afrouxar F31/F32, allowlists, pins de Actions ou gates de operação.

A continuidade de desenvolvimento e publicação de código/documentação em branches de revisão está autorizada. Avançar no trabalho de laboratório sem pedir novamente essa aprovação. Merge, deploy, VPS/DNS, gastos, dados reais e comunicação externa não decorrem de CI verde. Registrar impedimentos concretos, sem converter trabalho autorizado em nova rodada de confirmação.
