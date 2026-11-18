# Faísca R05 — ponte de conversa com Imagine Agents

18/11/2026, America/Sao_Paulo. Base Comercial: [R04 #456](https://github.com/rafhael100/imagine-comercial/pull/456), SHA `5cc938e72f3ec1df7f61dbd68be97d68bc79f569`. Base funcional Agents revalidada: [P67 #476](https://github.com/rafhael100/imagine-ai-agents/pull/476), SHA `0c722eee6bd53a7ee46c4ba68ab70200fc191b78`.

## Responsabilidade de cada componente

O browser conserva a interface e o protocolo HTTP R04. O servidor Node conserva a sessão, o contexto público, as jornadas, o resumo, a deduplicação e a reconciliação. Seu adaptador R05 executa uma CLI PHP de um checkout Agents fixado, usando pipes privados de stdin/stdout e um processo por despacho.

O componente PHP executa os objetos existentes de conhecimento e coordenação do Agents: `MockKnowledgeRetriever`, `MockContextEnvelope`, `SupervisedCoordinator`, `Run` e `MockAiSuggestionProvider`. O callback continua sujeito às proteções de leitura e aos campos sintéticos aceitos pelo coordenador. Nenhum contrato CRM ou dispatcher é ampliado para aceitar conversa livre.

O texto apresentado ao visitante continua sendo o candidato editorial do Comercial. O PHP produz uma sugestão sintética e um recibo correlacionado; só depois de validar esse resultado o adaptador devolve o candidato ao runtime. O runtime exige a correspondência integral ao candidato curado. **Execução PHP real não é geração por um modelo de IA.**

## Dados que atravessam o pipe

O pedido tem schema fechado `faisca.agents.request.v1` e contém:

- Identificação aleatória da invocação e IDs opacos da conversa/mensagem.
- Fingerprint SHA-256 canônico do pedido R03 e SHA-256 do candidato editorial.
- Idioma `pt-BR`.
- Escopo fixo `public_comercial`, versão editorial e digest do conhecimento.
- IDs das fontes e ações utilizadas pelo candidato, limitados ao catálogo revisado.

Texto livre do visitante, texto completo da resposta, token Bearer, credenciais, empresa, usuário autenticado, preço, endpoint e escolha de provedor não fazem parte do pedido. Os hashes são referências de correlação; não autenticam pessoas nem tornam um dado automaticamente anônimo.

O digest de conhecimento corresponde aos bytes UTF-8 integrais de `ops/faisca/knowledge.mjs`, preservados da R04:

```text
knowledgeVersion: faisca-editorial-2
knowledgeDigest: fe7daf5ab310acc5a0a600803254344ed02eff7bbd860b731cdf033dcbe4ead7
```

A política fixa do Agents está em `contracts/faisca/public-context-v1.json`. O consumidor verifica seu hash entre os arquivos pinados. O PHP compara versão, digest, fontes e ações com a política local; a mensagem não escolhe a política que a autoriza.

## Execução no Agents

O contexto de domínio é uma fixture `SYNTHETIC_FAISCA_*` definida no código, sem relação com uma empresa ou cliente autenticado. IDs do chat ficam no envelope de correlação e não concedem identidade ou permissão.

O componente seleciona uma fonte sintética própria do Faísca, entrega seu contexto pelo mecanismo existente, inicia um Run, cria sua etapa e solicita uma sugestão ao coordenador. A projeção passada ao provider respeita os limites existentes: até três campos `ref/stage/text`, iniciados por `SYNTHETIC` e com até 256 bytes. A sugestão é validada integralmente, e o contexto de conhecimento é revalidado antes da entrega. O gateway de efeitos é explicitamente recusador.

O sucesso usa `faisca.agents.result.v1` e devolve a mesma correlação, versão/digest do contexto, a sugestão fixa do mock e evidências restritas: Run concluído, uma sugestão, uma passagem de conhecimento e zero efeitos. `operationalEffects` permanece `false`. Esses campos descrevem o laboratório; não são assinatura ou atestado de autorização operacional.

Erros conhecidos usam `faisca.agents.error.v1`, um código fechado e exit code 2. Não incluem a entrada, stack trace ou conteúdo de stderr. O Node exige um único JSON, saída limitada e combinação válida de envelope e código de saída.

## Integridade e configuração

`ops/faisca/agents/pin.json` contém a SHA Agents revisada e os hashes SHA-256 dos arquivos realmente executados. Esta candidata fixa a [PR Agents #478](https://github.com/rafhael100/imagine-ai-agents/pull/478), SHA `59d0bae5340c23b37ea1e693e3a1f3915de3c075`. O workflow de integração faz checkout dessa mesma SHA. O adaptador verifica HEAD, arquivos, política e conhecimento local antes de iniciar o PHP, e revalida a integridade antes de aceitar a entrega.

O processo usa argumentos separados, sem shell, ambiente mínimo e caminho de entrypoint fixo. Configuração de executável, checkout, cenário e prazo máximo pertence ao servidor confiável. Nenhum desses campos pode ser ativado por uma mensagem HTTP. A CLI R05 exige flags explícitas de laboratório e escuta somente em loopback por meio do servidor R04.

Os pins protegem a correspondência com o código revisado. Não substituem isolamento do sistema operacional contra quem já controla o executável, o processo ou o filesystem do operador.

## Timeout, falha e conciliação

Há dois prazos diferentes:

1. O timeout leve do runtime libera o estado `unknown` para a UI, mantendo a execução PHP viva. Uma resposta tardia válida fica disponível para a consulta da mensagem original.
2. O prazo máximo do subprocesso encerra um child que excedeu o limite. Depois de iniciado o processo, perda da resposta, saída inválida/excessiva ou encerramento anormal produz `provider_unknown`, sem reiniciar a mesma operação.

O runtime preserva o primeiro resultado incerto e não transforma a perda de resposta em prova de não execução. A conciliação lê o registro existente; não cria outro processo. Se o processo terminou sem um resultado recuperável, a consulta continua incerta e a sessão precisa ser reiniciada para uma nova conversa.

Ausência do executável antes do início e recusa PHP conhecida são classificadas como indisponibilidade declarada. Nenhum caso retorna sucesso silencioso sem executar e validar a ponte.

Desconectar o HTTP não cancela automaticamente o PHP. Reset, exclusão ou expiração da sessão invalidam a entrega e descartam seus processos. O fechamento do laboratório aguarda a drenagem dos children próprios. Uma resposta `401` após despacho não afirma que a operação nunca aconteceu.

## Cenários e comprovação

A configuração confiável dos testes permite sucesso, atraso, indisponibilidade, saída malformada, encerramento depois do despacho e revogação sintética antes da entrega. O corpo do pedido não escolhe esses cenários.

Os testes de processo locais que usam fixtures Node são explicitamente testes de framing/ciclo de vida; não comprovam PHP. A integração obrigatória no CI exige PHP real, checkout exato, invocação observada, encerramento, recibo validado e resposta recebida pelo runtime/browser. A ausência de PHP não vira skip ou sucesso simulado.

A revogação de conhecimento exercitada é do grant sintético do Agents. A sessão HTTP também é revalidada pelo servidor na entrega. Isso não implementa IAM, revogação distribuída ou acesso de pós-venda autenticado.

## Isolamento do produto

O mascote, o template base, os estilos, a UI compartilhada e as páginas públicas permanecem fora das alterações de integração. O standalone e os modos anteriores continuam disponíveis. Os registros são voláteis; não há banco de conversa ou reserva financeira.

Não há chamadas a modelo pago, CRM, Portal, serviços de produção ou dados reais. A publicação é de código e documentação em PRs draft nos dois repositórios. A evolução para um provider operacional depende de política de fontes, identidade, retenção e orçamento próprios, sem converter o recibo sintético desta entrega em autorização.
