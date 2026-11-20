# Faísca R137 — bloqueio editorial independente na interface privada

**Base:** R136 #611, HEAD pinada 406babe1037b2a56ff0889b375b964bd590c5c50.

## Problema

R135 e R136 reforçaram o gate do servidor HTTP para recusar promessas de resultados e números de vendas/leads inventados. A interface privada, porém, ainda aceitaria uma resposta HTTP 200 sintaticamente correta com essas alegações se fosse recebida de um adaptador local defeituoso. O navegador é a última fronteira de exibição, não uma fonte de autoridade.

## Implementação

PRIVATE_REVIEW_JS acrescenta tripwires conservadores equivalentes aos do servidor para frases de garantia e projeções numéricas categóricas. Os testes executam o script real em VM isolada com respostas fictícias, cobrindo tanto o menu fixo quanto a conversa livre: rejeição de texto e fontes, limpeza do bearer, recuperação da interface e ausência de repetição de chamada. Controles positivos mantêm explicações não promissórias.

Executar: node --test tests/faisca-r137-browser-marketing-egress.test.mjs

**Limitações:** defesa em profundidade lexical, não verificação semântica, documental ou de campanhas. A decisão autoritativa continua no servidor e a revisão humana independente permanece obrigatória.

**NO-GO público:** nem esta entrega nem a CI permitem merge, deploy, VPS, DNS, atendimento, lead, checkout, CRM ou Portal operacionais. Não presumir R95–R137 instaladas. Preservar mascote, site público, main e publicFaiscaEnabled=false.
