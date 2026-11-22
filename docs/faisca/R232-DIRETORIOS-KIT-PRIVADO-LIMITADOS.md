# Faísca R232 — inventário do kit privado por diretório iterado e limitado

## Risco

O verificador de staging privado R38–R231 usava `readdir({ withFileTypes: true })` em cada diretório, criando uma lista em memória **antes** de avaliar o limite de arquivos. Além disso, ignorava diretórios vazios não declarados no manifesto e aceitava profundidade arbitrária. Uma árvore sintética com milhares de entradas podia consumir memória e tempo sem representar novos arquivos no relatório.

## Controle

A travessia utiliza agora `opendir()` como iterador assíncrono, com teto global de 390 diretórios, 788 entradas e profundidade de 24 níveis, além do limite existente de 390 arquivos. Caminhos de diretórios são confinados a `site/` e `ops/staging/` revisados; diretórios extras no topo são recusados mesmo que vazios. A leitura por arquivo continua limitada e validada por SHA-256, conforme R231.

Testes com fixtures exclusivamente locais cobrem diretório vazio inesperado, 391 diretórios extras e profundidade excessiva, preservando o kit positivo R38. Os controles complementam, mas não substituem, verificação independente de origem do pacote, permissões/volume de staging, `nginx -T` e HTTP 401/403 em host privado.

## Comandos de laboratório

```bash
node --test tests/faisca-r38-private-staging-kit.test.mjs
npm test
npm run test:browser
```

**Restrições:** branch draft empilhada sobre R231; nenhum merge/deploy, VPS, DNS, senha, chamada paga, dados reais ou ação operacional Portal/Sites. O teste pago Luna/Terra e a homologação R92 previamente relatados não são repetidos. R95–R232 não é presumida instalada. `publicFaiscaEnabled=false`. **NO-GO público** até homologação acumulada, reconciliação externa e revisões AppSec/LGPD/FinOps/editorial.
