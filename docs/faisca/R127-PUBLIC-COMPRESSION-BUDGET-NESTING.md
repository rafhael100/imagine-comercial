# Faísca R127 — limitar inflação agregada e negar compressão pública aninhada

## Risco isolado
O auditor R126 da saída pública descomprime uma camada por extensão `.gz` ou `.br` e limita cada arquivo expandido a 12 MiB. Sem controle agregado, muitos arquivos pequenos comprimidos podem forçar gigabytes de expansão durante a revisão. Um asset `bundle.js.gz.br` (ou um gzip dentro de outro gzip nomeado apenas `.gz`) esconde marcadores de implementação privada da inspeção de uma camada.

## Correção
- Rejeitar como **NO-GO** artefatos com duas extensões de compressão consecutivas, independentemente do conteúdo. Não são necessários para o pacote público revisado.
- Identificar gzip aninhado por assinatura depois de uma primeira expansão, mesmo quando falta a extensão interna.
- Manter o limite individual de 12 MiB e acrescentar orçamento **agregado de 160 MiB descomprimidos** em uma única auditoria, com erro fechado.
- Expor apenas contador de bytes expandidos no relatório local; sem registrar conteúdo, segredo, mensagens ou identificadores.
- Preservar a inspeção de bytes crus, os controles do mascote e a validação UTF-8 da R126.

## Prova executável
```sh
node --test tests/faisca-r127-compressed-archive-budget.test.mjs
node --test tests/faisca-r126-public-compressed-private-leak.test.mjs
npm test
```

As fixtures são inteiramente fictícias e verificam gzip/Brotli em duas camadas, gzip disfarçado, quinze arquivos individualmente válidos que superam o orçamento agregado, e assets benignos de uma camada.

## Limites e gates
Não é DLP integral. Compressão sem assinatura inequívoca, obfuscação textual, conteúdo cifrado, outros formatos e alterações após a auditoria ainda exigem revisão independente. A CI Node/HTTP/Chromium/axe, build e segurança comprova somente o checkout exato, não execução ou implantação na VPS.

A homologação R92 é respeitada conforme relato do operador; R95–R127 não são presumidas instaladas. Mantidos `main`, site, mascote aprovado e `publicFaiscaEnabled=false`. Sem merge, deploy, DNS/VPS, dados reais, chaves, OpenAI paga, CRM/Portal operacional, leads, tickets ou cobranças.
