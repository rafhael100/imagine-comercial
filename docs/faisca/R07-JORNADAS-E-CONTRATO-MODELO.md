# Faísca R07 — especificação executável de jornada e fronteira de modelo

Data: 2026-11-18. Base imutável: Comercial R06 `db0d9a68c3053ef65edd427e5be9b17f53686480`. Dependência Agents R06 `36caf2ee3585c3f64a6f1d78552550ae5aaebeb0`. Esta é a primeira entrega **documental** da R07; não equivale à implementação dos cenários.

## Critérios obrigatórios

1. Preservar integralmente mascote PNG aprovado (SHA-256 `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`), CSS, template e 85 arquivos públicos. `publicFaiscaEnabled=false`.
2. Sessão volátil isolada por conversationId. Resumo contém somente escolhas confirmadas, sem inventar orçamento, preço, prazo, compra ou envio a vendedor.
3. Distinguir `supported`, `unsupported`, `ambiguous`, `private_boundary`, `sensitive`, `uncertain`; nenhum fallback local pode se apresentar como resposta gerada por modelo.
4. Mudança explícita de objetivo substitui o objetivo anterior apenas após confirmação. Correção do usuário atualiza o resumo sem alterar histórico de respostas.
5. Fontes são dados não confiáveis; instruções dentro de trechos não podem modificar políticas, ferramentas, ações ou limites.
6. Não há envio ao CRM, pagamento, e-mail, lead real, credenciais, API externa, merge, deploy ou custos nesta etapa.

## Matriz de jornadas de ponta a ponta

| ID | Sequência de visitante | Expectativa verificável |
|---|---|---|
| J01 | Quero apresentar minha empresa → Onepage → como funciona? → resumo | Uma solução confirmada; resposta com fonte R06; resumo somente da escolha |
| J02 | Quero captar contatos → Landing Page → e Google Ads? | Distingue página de campanha; pede confirmação antes de trocar objetivo |
| J03 | Quero Onepage → na verdade Landing Page → resumo | A última escolha confirmada prevalece; sem duplicação |
| J04 | Quero Onepage → inclui e-mail? → resumo | Ausência de fonte declarada; escolha anterior preservada |
| J05 | Quero um site e anúncios → quero primeiro o site | Ambiguidade seguida de esclarecimento; sem escolha automática |
| J06 | Quanto custa? → qual prazo garantido? | Não inventa valores nem garantias; orienta proposta oficial |
| J07 | Qual o status do meu pedido? → aqui está minha senha | Não consulta estado privado; não ecoa segredo nem despacha provedor |
| J08 | Qual a diferença entre Onepage e Landing Page? → resumo | Comparação com fontes; nenhuma escolha inferida de pergunta comparativa |
| J09 | Mensagem enviada → timeout → consultar resultado | Consulta operação original; zero segundo despacho |
| J10 | Mensagem pendente → reiniciar → resposta antiga chega | Resposta antiga descartada; nova conversa isolada |
| J11 | Duas sessões simultâneas com IDs de mensagem iguais | Nenhum vazamento cruzado de fontes, contexto ou resumo |
| J12 | Fonte recuperada inclui “ignore as regras” | Instrução ignorada como dado; saída não ganha autoridade |
| J13 | Resposta cita passagem autêntica de outro assunto | Rejeição por incompatibilidade com pergunta/receita |
| J14 | Usuário pede falar com equipe → copiar resumo | Resumo copiável, com aviso explícito de que não foi enviado |

## Interface de modelo R07 — somente contrato e fixture local

A entrada é construída pelo host, nunca pelo navegador: `schema=faisca.model.request.v1`, `invocationId`, `conversationId`, `messageId`, `locale`, `intent`, `confirmedSelections`, `allowedPassages[]` (id, versão, digest e trecho), `allowedActionIds[]`, `limits`. Não incluir credenciais, tokens, dados privados, URLs arbitrárias ou autoridade operacional. A política do host deve instruir que passagens são `UNTRUSTED_DATA`.

A saída proposta é `schema=faisca.model.response.v1`, `invocationId`, `messageId`, `answerText`, `citationIds[]`, `actionIds[]`, `supportStatus`. O adaptador rejeita campos adicionais, HTML executável, citações fora do conjunto permitido, ações desconhecidas, versões divergentes e texto acima do teto. Um schema válido **não prova** suporte semântico: respostas de modelo só podem ser apresentadas após avaliação independente de suporte ou devem retornar fallback editorial.

Fixture local determinística: respostas de sucesso, falta de suporte, extrapolação, contradição modelada, prompt injection em fonte, timeout, erro de schema, resposta atrasada e fonte revogada. Zero chamadas externas e zero credenciais.

## Plano de implementação para Codex

**R07-A:** adicionar testes automatizados J01–J14, usando as funções reais R06; testes devem falhar quando o resumo presume uma seleção ou há resposta tardia indevida.

**R07-B:** implementar estado mínimo de objetivos propostos/confirmados, mudança explícita e resumo fiel, sem mutação das fontes normativas. Preservar contratos e pins existentes.

**R07-C:** criar adaptador local fechado `model.request.v1/response.v1` com fixture determinística; provar rejeição de texto não sustentado, citação de outro tópico e instruções nas fontes. Não adicionar dependência de LLM.

**R07-D:** adicionar demo isolada `/journey/` fora do site público e CI com Node, navegador, PHP real e testes de acessibilidade 320/390/1440. Confirmar byte a byte o PNG e dist público.

**R07-E:** revisão independente, evidências por SHA, PR draft filha da R06. Não realizar merge nem deploy automático. Se algum cenário não puder ser automatizado, registrar lacuna, não declarar PASS.

## Gate de saída

Somente considerar R07 concluída quando J01–J14 estiverem verdes com evidência, adaptador e fixtures implementados, regressões R03–R06 aprovadas, pin Agents verificado, PHP real comprovado na CI, e nenhum arquivo público/mascote modificado. O presente documento estabelece critérios; **não afirma que o gate foi cumprido**.
