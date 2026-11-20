# Faísca R136 — afirmações comerciais quantitativas sem base

Base imutável: R135 #610, HEAD `bc1b3bfcec63a113ebdbb46e8b93bcbe41005f58` (6/6 CI).

## Correção concreta

O filtro R135 recusava “garante vendas”, mas não reconhecia flexões como “garantimos vendas”, “garantirá posição” nem previsões numéricas categóricas sem a palavra garantia (“vai gerar 120 leads”, “terá 50 clientes”). Na conversa privada fictícia, nenhuma dessas afirmações possui validação de campanha ou métricas reais.

A política passa a rejeitar essas formas na mesma função `hasPrivateUnsupportedOutcomeGuarantee`, já aplicada nos dois endpoints de saída HTTP e no fluxo geral de conversa. Respostas negativas geram 503 sem eco nem retentativas. Afirmações qualitativas não promissórias continuam possíveis.

## Verificações

- `node --test tests/faisca-r136-private-quantified-outcomes.test.mjs`: flexões, previsões numéricas e controles positivos.
- `node --test tests/faisca-r136-private-quantified-outcomes-http.test.mjs`: HTTP real autenticado em loopback, provedor sintético, endpoints fixo e livre, sem API paga.
- CI abrangente: Node, HTTP, Chromium/axe, compatibilidade Portal/Onepage, PHP, PostgreSQL descartável e Comercial/SEO/build.

**Limitações:** filtro lexical conservador; não é compreensão semântica nem avaliação factual universal. Falsos positivos e paráfrases permanecem sujeitos à revisão editorial humana.

**NO-GO público:** PR draft empilhada sobre R135; nenhuma alteração em `main`, site, mascote, `publicFaiscaEnabled=false`, VPS, DNS ou produção. Homologação R92 já relatada pelo operador não prova instalação das versões seguintes; o staging acumulado e a revisão independente ainda são gates. Não há dados reais, chamadas pagas nem integração operacional Portal/CRM.
