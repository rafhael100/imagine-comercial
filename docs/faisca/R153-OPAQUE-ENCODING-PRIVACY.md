# Faísca R153 — barreira para payloads opacos codificados (somente laboratório)

## Falha modelada

R152 recusa percent-encoding, HTML entities e escapes JS; não barrava uma cadeia base64-like longa sem qualquer símbolo de URL/e-mail ou bytes de quoted-printable (por exemplo, `pessoa=40exemplo=2Einvalid`). Uma pergunta fictícia digitada pelo operador poderia, portanto, esconder identificadores dos filtros lexicais. Todos os marcadores desta entrega são inventados, sem clientes ou credenciais.

## Correção e provas

- `private-identifier-risk.mjs` bloqueia segmentos opacos base64-like de **28+ caracteres** e escapes quoted-printable `=HH` sem decodificar, armazenar ou registrar o conteúdo. Mantém aceitação de `20% de crescimento` e orientações gerais sem identificadores.
- `private-review-page.mjs` acrescenta uma segunda fronteira independente, antes do POST e antes da renderização de HTTP 200, mesmo quando servidor/proxy devolver envelope aparentemente válido.
- `tests/faisca-r153-opaque-encoding-privacy.test.mjs` exercita a barreira de entrada, endpoint HTTP autenticado em loopback, cliente simulado Luna/Terra sem retry, navegador VM com resultado adulterado e caso positivo sem identificadores.
- `private-conversation-browser-qa.mjs` acrescenta Chromium real com negação de pergunta opaca e resposta forjada, limpeza de token/pergunta e zero chamada ao provedor no caso negativo.

## Limites e critérios de aprovação

É uma **heurística conservadora**, não uma solução universal de DLP. Não inspeciona base64 curtos nem todos os encodings e poderá rejeitar blocos opacos legítimos; isso é deliberado para laboratório com dados exclusivamente sintéticos. Não usar dados reais para validar. O servidor autoritativo continua fail-closed; a interface não transmite chave OpenAI.

Exigir CI da HEAD exata (Node, HTTP, Chromium, axe/WCAG, PHP, PostgreSQL descartável, Comercial/SEO/build), revisão independente AppSec/LGPD/editorial e homologação privada cumulativa por operador com SHA independente. A R92 e o teste pago Luna/Terra já relatados não são repetidos. O incremento não modifica a VPS nem instala R95–R153; mantém mascote, `main`, site público e `publicFaiscaEnabled=false`, sem merge/deploy, DNS, CRM, Portal, leads, tickets ou cobrança.
