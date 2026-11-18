# Codex — estado R06 e continuidade do Faísca

18/11/2026, America/Sao_Paulo. Projeto FAISCA, prioridade Imagine Comercial. Atividade: [#444](https://github.com/rafhael100/imagine-comercial/issues/444). Preservar integralmente a imagem aprovada.

## Base entregue e reutilizada

| Etapa | Entrega |
|---|---|
| [R02 #452](https://github.com/rafhael100/imagine-comercial/pull/452) | PNG aprovado, demo guiada, lifecycle, Astro e acessibilidade; SHA `c833c12ff34aaeba56549ae5dc41763a6a909b2a` |
| [R03 #453](https://github.com/rafhael100/imagine-comercial/pull/453) | Contrato fechado, simulador, deduplicação, incerteza e conciliação; SHA `7baf105b3601774b62c3492340e552300caf5e5b` |
| [R04 #456](https://github.com/rafhael100/imagine-comercial/pull/456) | HTTP loopback, sessão/contexto do servidor, limites, expiração e cliente volátil; SHA `5cc938e72f3ec1df7f61dbd68be97d68bc79f569` |
| [R05 #457](https://github.com/rafhael100/imagine-comercial/pull/457) | Processo PHP real, pin e recibo sintético de execução; SHA `84b4c82d1a7ff77b4ee7212bc877d4639ceb809d` |
| R06 desta branch | 21 trechos literais, 11 receitas, procedência visível, recomposição PHP e vínculo exato entre turno, trecho e resposta |

Leia `CONTRATO-CONHECIMENTO-R06.md`, `VALIDACAO-R06.md` e `ops/faisca/README.md`. A R06 tem entrada `ops/faisca/grounding/serve.mjs`, porta 4332, rota `/grounded/`. R03/R04/R05 permanecem reproduzíveis; seu pin R05 continua na SHA Agents `59d0bae5340c23b37ea1e693e3a1f3915de3c075`.

O componente [Agents R06 #484](https://github.com/rafhael100/imagine-ai-agents/pull/484) é filho da R05 #478, sem misturar P68 ou n8n. A SHA executada e seus 23 hashes estão em `ops/faisca/grounding/pin.json`, e a CI Comercial fixa exatamente a mesma SHA. Nunca substituir esse valor por uma branch móvel nem presumir que as PRs draft foram integradas.

## O que a R06 comprova

O catálogo contém trechos extraídos literalmente de `services.mjs`, `commercial-faq.mjs` e `commercial-process.mjs`, no snapshot Comercial R05. O verificador confere arquivo, seletor, texto e hash; o processo exige uma cópia normativa idêntica no Agents.

O PHP resolve os trechos por receita, recompõe toda a resposta e confere seu digest. O Node valida o recibo, os registros completos, a ordem, o texto e o vínculo. O browser confere o resultado integral contra o turno preparado, recusando até uma fonte válida de outro assunto. A resposta visível usa os bytes devolvidos pelo PHP, com citações expansíveis.

Navegação, pós-venda privado, CRM, ausência de fonte e ambiguidade são orientações locais explicitamente identificadas, com `sources=[]`, sem despacho PHP. Ausência/ambiguidade preservam a seleção anterior. Sensíveis e instruções indevidas continuam bloqueados antes da rede. Não confundir esse roteamento finito com compreensão universal de linguagem natural.

O recibo R05 continua demonstrando a execução dos mocks originais; seus limites não foram ampliados. A recuperação comercial UTF-8 está em uma camada própria. As passagens são `UNTRUSTED_DATA`. `factKey/factValue` detecta somente conflitos previamente rotulados, sem inferência geral de contradições.

Conciliação não redispara PHP, não insere resposta tardia sozinha e não recupera resultados entre reinícios. Revogação, expiração e fonte desabilitada impedem a entrega. As suites reais exigem PHP e não tratam sua ausência como skip.

## Próximo recorte R07: conversa completa e fronteira de modelo

Usar a base literal aprovada para avaliar uma conversa comercial de vários turnos e preparar uma adaptação estruturada de provedor, ainda sem ativar serviço externo. O resultado deve ser uma jornada demonstrável e um contrato testável, preservando os limites explícitos da R06.

1. Revalidar HEADs, instruções e frentes concorrentes. Continuar em branch filha da R06 publicada; não incorporar linhas de segurança, n8n, Portal ou CRM apenas por proximidade temporal.
2. Exercitar jornadas completas de escolha, dúvida e encaminhamento: mudança de objetivo, comparação, pergunta sem fonte, correção pelo usuário e resumo final. O resumo deve refletir somente seleções confirmadas; cópia não é envio à equipe.
3. Definir a interface de provedor conforme a seção “Fronteira de um futuro provedor de modelo” do contrato R06. Entrada mínima, fontes delimitadas, saída fechada, ações permitidas e limites do host são obrigatórios. Implementar primeiro o adaptador e fixtures locais identificados, sem credenciais, chamadas pagas ou dados reais.
4. Manter separados o vínculo exato da R06 e a futura avaliação de suporte semântico. Uma resposta diferente pode ser bem formatada e ainda inventar uma alegação. Dataset e critérios devem identificar ausência de fonte, extrapolação, contradição modelada e instruções dentro do conteúdo recuperado.
5. Preservar os comportamentos de timeout, resultado incerto, consulta manual, reset, desmontagem e expiração. Não introduzir retry automático após despacho nem converter o ledger volátil em garantia de cobrança única.
6. Entregar a demonstração, contrato, limites e evidências vinculadas às SHAs em PRs draft. A ativação de um provedor concreto precisa de escolha explícita, contrato/dados/custo atuais e credenciais privadas; isso não impede concluir a parte local autorizada.

## Frentes paralelas observadas na R06

Comercial #458/#459 seguem uma linha separada de custos anônimos e auditoria SEO, derivada da #455. Agents #477 trata P68; #480 trata documentação da jornada, e #479/#481/#482/#483 são composições de n8n/providers. Foram observadas, não incorporadas. Antes de continuar, conferir o estado atual em vez de tratar esta lista datada como inventário completo.

O receiver Central permanece privado/mTLS para eventos CRM; `MockSyntheticHttpEnvelope` é inerte. Nenhum contrato privado substitui a entrada pública de conversa. Laboratórios PostgreSQL mantêm seus guards de CI descartável.

## Preservação e autorização

SHA-256 aprovado do PNG: `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`. Preservar imagem, recorte, cores, template base, estilos e jornadas. A R06 acrescentou uma política confiável de turno à UI compartilhada; não redesenhou o mascote.

Manter laboratório fora de `src/pages`, `public`, sitemap e dist público. Não afrouxar F31/F32, allowlists, pins de Actions ou gates existentes. O catálogo R06 continua uma versão editorial de revisão, sem validade contratual automática ou consulta a cliente.

A continuidade de desenvolvimento e publicação de código/documentação em branches de revisão está autorizada. Avançar nesse trabalho sem repetir o pedido de aprovação. Merge, deploy, VPS/DNS, gastos, dados reais e comunicação externa não decorrem de CI verde. Registrar impedimentos concretos e evidências de execução; distinguir código publicado para revisão de funcionalidade ativada em produção.
