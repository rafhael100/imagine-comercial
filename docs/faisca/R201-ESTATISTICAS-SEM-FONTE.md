# Faísca R201 — estatísticas e pesquisas sem fonte no laboratório privado

## Correção incremental de qualidade editorial

As respostas livres da Terra na conversa fictícia não possuem um conjunto de dados verificado para percentuais, volume de leads, conversões, inscrições ou resultados de estudos. A R147/R156 já rejeitava atribuições indevidas a marcas e métricas específicas, mas ainda aceitava formulações como "83% dos usuários preferem..." e "pesquisas recentes mostram...".

A R201 amplia a verificação determinística de `hasPrivateUnsupportedOutcomeGuarantee`, reutilizada em `safePrivateGeneralReply`, no adaptador Luna/Terra e na saída HTTP. Rejeita estatísticas sem evidência, contagens comerciais específicas e alegações de pesquisas, relatórios ou especialistas anônimos. A saída HTTP é 503 genérica, sem devolver o texto do modelo, o token ou os detalhes internos.

`node --test tests/faisca-r201-private-ungrounded-statistics.test.mjs` testa corpus negativo e orientação genérica aceitável, inclusive HTTP real em loopback com adaptador simulado. `npm test` inclui a prova, com validações Chromium/axe, Onepage/Portal, PHP, PG e SEO nos workflows existentes.

## Alcance, limites e gates

Uma regex não é verificação semântica nem comprovação factual; outras alucinações ainda podem passar. Respostas geradas permanecem marcadas para **revisão editorial humana**. Respostas editoriais fixas continuam vinculadas aos documentos revisados; nenhuma fonte externa é consultada ou considerada aprovada automaticamente.

Somente fixtures sintéticas e chamadas HTTP locais; sem uso de dados reais, chave OpenAI, custo pago, staging da VPS ou integrações operacionais. R92 e os testes reais anteriores informados pelo operador foram preservados sem repetição. R95–R201 ainda dependem de homologação acumulada em ambiente privado, revisão AppSec/LGPD/FinOps/editorial e reconciliação independente do consumo.

**NO-GO público:** `publicFaiscaEnabled=false`, `main`, mascote e site comercial intactos; sem merge, deploy, alterações VPS/DNS, CRM/Portal/Sites operacional, leads, tickets ou cobranças.
