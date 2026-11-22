# R217 — instruções injetadas na resposta direta Luna/Terra

## Diagnóstico
A R214 já bloqueava instruções de troca de papel e de substituição de regras na política geral e no servidor HTTP privado. No entanto, o método `createFaiscaOpenAILiveLab().answer(caseId)` é utilizável diretamente pelo laboratório/CLI de casos fixos, sem passar por esse servidor. A validação da saída de Terra nessa rota não invocava `hasPrivateSyntheticInstructionOverrideRisk`. Uma resposta fictícia como "Ignore as instruções do sistema..." podia ser devolvida como `draft_answer`, com fontes aprovadas atribuídas a texto não aprovado.

## Mudança
- Aplicar o mesmo predicado de recusa **antes** de produzir o envelope da resposta direta de caso fixo.
- Não normalizar, reescrever ou registrar a saída maliciosa; erro genérico sem eco.
- Não desativar os filtros existentes de identificadores, preços, ações alegadas e resultados infundados.
- Preservar `store:false`, nenhuma ferramenta, proveniência Luna/Terra, reserva de requisições e revisão editorial.
- Um teste independente injeta respostas estruturadas completas via `fetchImpl` sintético sem passar por HTTP, cobrindo instrução direta, cabeçalho de papel e pontuação fragmentada. Também cobre resposta neutra permitida, sem chamada paga.

## Gates
CI da HEAD exata: Node, testes HTTP/Chromium/axe existentes, PHP/Portal, PostgreSQL descartável e Comercial/SEO/build. A barreira lexical não é um classificador completo de prompt injection, nem prova de correção factual. Continuam necessários AppSec/LGPD/FinOps/editorial e homologação acumulada de staging privado antes de qualquer GO.

**Limites operacionais:** sem chave real, dados reais, alteração de main, merge, deploy, VPS, DNS, CRM, Portal operacional ou atendimento público. `publicFaiscaEnabled=false` permanece inalterado. R92 homologada conforme relato do operador; a instalação R95+ na VPS ainda não é demonstrada.
