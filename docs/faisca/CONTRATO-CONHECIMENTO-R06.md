# Faísca R06 — pergunta, trecho, resposta e fonte

18/11/2026, America/Sao_Paulo. Laboratório determinístico sobre Comercial R05 [#457](https://github.com/rafhael100/imagine-comercial/pull/457) e Agents R05 [#478](https://github.com/rafhael100/imagine-ai-agents/pull/478). Este contrato complementa, sem substituir, os contratos R03, HTTP R04 e Agents R05.

## Conteúdo e autoridade editorial

`ops/faisca/grounding/catalog.json` contém **21 trechos literais e 11 respostas compostas**. A origem é o snapshot Comercial `84b4c82d1a7ff77b4ee7212bc877d4639ceb809d`, em três arquivos: `src/data/services.mjs`, `src/data/commercial-faq.mjs` e `src/data/commercial-process.mjs`. O verificador `scripts/verify-faisca-grounding.mjs` confere hashes dos arquivos, seletores, conteúdo literal, digest de cada trecho, receitas e a cópia compilada `catalog.mjs`.

Versão do catálogo: `faisca-grounding-1`. SHA-256 dos bytes JSON, incluindo sua quebra de linha final: `205754a9b45e723560276e0f7145b05b1a1d3eb6d87c5dd9e006ce84b9aceed8`. O Agents conserva uma cópia byte a byte em `contracts/faisca/public-passages-v1.json`; a classe PHP exige esse digest normativo. Um hash enviado pelo solicitante não pode aprovar um catálogo diferente.

Cada passagem declara `id`, `title`, `sourcePath`, `selector`, `text`, `digest`, `factKey` e `factValue`. Fonte e versão são resolvidas internamente; texto do visitante não escolhe caminho, fonte, catálogo, ferramenta ou política. Cada resposta usa uma receita curada: `id`, `passageIds`, `prefix`, `suffix` e `actionIds`.

Os trechos continuam sendo dados sem autoridade operacional. O PHP os devolve marcados `trust: UNTRUSTED_DATA`. A versão editorial não prova disponibilidade atual de produto, autorização de cliente, preço contratual, SLA ou resultado comercial. Preços e condições permanecem sujeitos à proposta oficial.

## Seleção da orientação

`groundedRespond(session, input)` executa a pré-verificação original antes de classificar o assunto. A seleção é finita e conservadora, sem embeddings, busca livre ou interpretação por LLM.

| Caminho | Comportamento |
|---|---|
| Uma receita suportada | Compõe a resposta com os trechos exatos; despacha PHP |
| Informação ausente, como e-mail ou WordPress | Explica a ausência; não escolhe um objetivo nem despacha PHP |
| Temas ou objetivos diferentes na mesma pergunta | Pede escolha do assunto; preserva a sessão; não despacha PHP |
| Navegação, resumo e contato humano | Orientação local, sem citação comercial |
| Pós-venda privado, cobrança, status ou CRM | Explica o limite da orientação local; não consulta dados de cliente |
| Dados sensíveis ou instrução indevida | Pré-verificação original, antes da rede |

As quatro intenções locais são `grounding_navigation`, `grounding_boundary`, `grounding_unsupported` e `grounding_ambiguous`, todas com `sources=[]`. No HTTP, são resultados aceitos `guided_fallback`, com motivo explícito; não são respostas atribuídas ao PHP. UI, cliente HTTP e runtime usam a mesma política confiável para preparar o turno, preservando resumo e conciliação.

O dataset de perguntas e suas contraprovas está em `tests/faisca-grounding-catalog.test.mjs`. Ele não representa cobertura universal da linguagem natural. `factKey/factValue` identifica conflitos apenas entre fatos previamente rotulados; não há detector geral de contradições em prosa.

## Composição e citação

O texto é a junção, por duas quebras de linha, de: prefixo não vazio, cada `title + ':\n' + text` na ordem da receita, e sufixo não vazio. Os wrappers curados organizam a navegação e a pergunta seguinte; não acrescentam fatos comerciais novos.

O ID de citação é `faisca.passage.<id>@r06-1`, com versão `faisca-grounding-1`. O schema da resposta externa continua `faisca.response.v1`, e sua `knowledgeVersion` continua `faisca-editorial-2`. O validador verifica a versão de cada fonte individualmente. Não atribui a versão antiga a uma passagem nova.

Em **Base desta orientação**, a UI mostra título, snapshot editorial e o trecho literal usando `textContent`. Nenhum HTML vindo da passagem é interpretado. Não há inferência de veracidade apenas porque o identificador da fonte existe: texto, lista ordenada de passagens, versões e ações precisam corresponder à receita preparada.

## Processo Node → PHP

A configuração do host usa `grounding/pin.json`, com SHA completa do Agents e **23 hashes**: os 19 arquivos da ponte R05, mais CLI R06, catálogo e duas classes PHP novas. O entrypoint antigo fica pinado por compatibilidade, mas a R06 executa somente `tools/faisca_grounded_bridge.php`.

Antes de preparar, despachar e entregar, o Node confere checkout/HEAD, arquivos pinados, contexto R05 e integridade editorial local. A R06 acrescenta a conferência do catálogo e dos três arquivos comerciais. Alterar bytes depois da preparação invalida a entrega. O visitante nunca fornece a configuração desse processo.

O wire compacto `faisca.grounded.request.v1` contém somente:

```text
schema, invocationId, requestFingerprint, candidateDigest,
conversationId, messageId, locale,
grounding { catalogVersion, catalogDigest, answerId, passageIds }
```

Não contém texto do visitante, texto candidato, token HTTP, credencial, comando, caminho de arquivo ou seleção de provedor. O PHP resolve a receita e **reconstrói por conta própria toda a resposta** — correlação, conhecimento, texto, citações e ações — para conferir `candidateDigest`. Trocar por outra passagem legítima sem trocar corretamente a receita/resposta não passa.

O `GroundedConversationBridge` compõe a execução R05 com a nova recuperação literal. Os componentes `MockKnowledgeRetriever`, `MockContextEnvelope`, `SupervisedCoordinator` e `MockAiSuggestionProvider` mantêm seus limites originais. O recibo R05 contém evidência sintética do ciclo de execução; os trechos comerciais reais estão na seção R06 `grounding`. A fixture agregada antiga não é apresentada como documento recuperado.

O resultado `faisca.grounded.result.v1` contém `execution` (recibo R05 integral) e `grounding` (versão/digest do catálogo, receita, IDs ordenados, registros completos das passagens, texto e `bindingDigest`). O vínculo é SHA-256 do JSON compacto, nesta ordem:

```text
catalogVersion, catalogDigest, answerId, candidateDigest,
passageIds, passageDigests
```

O Node confere todos esses dados contra a receita local. O texto entregue é o texto retornado pelo PHP e validado contra o candidato. No navegador, uma segunda conferência exige o resultado integral esperado para o turno preparado, inclusive avisos de fallback e incerteza. Uma resposta HTTP sobre Meta Ads, mesmo com fonte e versão legítimas, não pode substituir uma pergunta sobre Onepage.

## Limites e ciclo de vida

| Limite | Valor |
|---|---|
| Catálogo PHP | Até 32.768 bytes, até 32 passagens e 32 receitas; catálogo normativo atual com 21/11 |
| Trecho | Até 512 bytes UTF-8; maior trecho atual com 258 bytes |
| Seleção por resposta | Até 3 trechos, soma de até 1.200 bytes |
| Texto composto PHP | Até 3.000 bytes; limite externo R03 de 3.000 caracteres também aplicado |
| Request e stdout do processo | Até 16 KiB cada, framing fechado |
| Entrada | Um JSON compacto encerrado por EOF |
| Saída | Um JSON compacto seguido de LF |
| Validade lógica da seleção | 30 segundos; revogação/fonte/relógio conferidos novamente na entrega |
| Atraso do fixture | 0–2.000 ms, configurado apenas pelo host |
| Prazo padrão do processo | 3 segundos |

O servidor continua exclusivamente em loopback, com Host/Origin e rotas exatos, token em memória e sessões voláteis. O processo só é habilitado com os guards HTTP, Agents e Grounded; não há chave de API externa.

Recusas conhecidas geram fallback local explícito. Deadline, saída inválida ou encerramento após despacho mantêm resultado incerto, sem retry automático. **Consultar resposta pendente** consulta o despacho original. A chegada tardia não insere uma mensagem espontaneamente. Reset, desmontagem e expiração descartam callbacks e encerram o estado da instância; não constituem persistência distribuída ou garantia financeira de execução única.

## Fronteira de um futuro provedor de modelo

Esta entrega define requisitos para uma adaptação futura; não inclui chamada, conta, credencial ou despesa de modelo.

- **Entrada:** apenas turno permitido após pré-verificação, contexto mínimo revisado, trechos limitados e identificados, e instrução de tratar fontes como dados. Nenhum segredo, identidade privada ou autorização de ferramenta entra por inferência.
- **Saída:** estrutura fechada com texto, IDs de citações e ações permitidas; sem HTML, URLs arbitrárias, comandos ou ferramentas. Recusar fonte desconhecida, alegação sem suporte, versão divergente ou formato inválido.
- **Qualidade:** dataset separado de perguntas com suporte, ausência, ambiguidade, contexto de turnos e tentativa de instrução nas fontes. O vínculo criptográfico desta R06 prova igualdade de bytes; não substitui avaliação de suporte semântico em prosa gerada.
- **Uso:** teto de tamanho, tempo, concorrência e custo definidos no host. Os contadores deste laboratório não são reserva de crédito. Contrato, preços, retenção e tratamento de dados do provedor precisam ser verificados quando um provedor concreto for escolhido.
- **Falhas:** preservar as distinções entre recusa, indisponibilidade e resultado incerto. Sem retry cego após despacho; sem geração inventada para encobrir falta de fonte.
- **Ativação:** uma integração externa depende de escopo concreto, credenciais privadas e autorização de custos/dados. O contrato futuro não autoriza merge, deploy ou acesso operacional.

## Evidência e preservação

`VALIDACAO-R06.md` registra resultados locais e execução PHP vinculada à SHA Agents. O corpo da PR Comercial vincula os checks da SHA efetivamente publicada. As suites reais recusam ausência de PHP e só registram `executedPHP=true` depois de observar um processo real bem-sucedido; fixtures Node unitárias são identificadas separadamente.

O PNG aprovado, template base, CSS, jornadas originais e conhecimento R02 permanecem byte a byte. A UI compartilhada recebeu somente a seleção confiável da política de turno; a R06 usa uma nova página isolada `/grounded/`. O site público permanece com `publicFaiscaEnabled=false`.
