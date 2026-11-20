# Faísca R128 — impedir rota privada escondida por escapes JS/JSON no dist público

## Falha de cobertura
R124–R127 recusam strings privadas em qualquer arquivo (inclusive comprimido), mas o mesmo identificador de endpoint pode ser representado em JavaScript/JSON com escapes ASCII como `\\u005f`, `\\x5f` e `\\u{5f}`. A inspeção literal da sequência de bytes não encontraria o texto resultante.

## Implementação
- Acrescenta verificação lexical adicional do conteúdo original e do payload já descomprimido, sem avaliar ou executar JavaScript.
- Decodifica **apenas** escapes explícitos de caracteres ASCII no formato acima, depois reutiliza a allowlist negativa de R124.
- Não altera publicações, rota, política de autenticação, interface, mascote ou resposta OpenAI; preserva limites de descompressão da R127.
- Testes sintéticos em `tests/faisca-r128-public-escaped-route-leak.test.mjs`: escapes Unicode, hexadecimais e mistos, gzip e conteúdo editorial benigno.

## Execução e limitações
```sh
node --test tests/faisca-r128-public-escaped-route-leak.test.mjs
npm test
```

É uma defesa lexical limitada: não constitui detecção universal de segredos e não cobre obfuscações arbitrárias, formatos cifrados ou avaliações dinâmicas. A revisão AppSec/editorial e a homologação de staging são obrigatórias e independentes.

Base: R127 #602, empilhada na R126 #601. A homologação R92 relatada foi respeitada; não presumir que R95+ foi instalada na VPS. `publicFaiscaEnabled=false`, `main`, site público e mascote aprovado intactos. Nenhum merge, deploy, DNS/VPS, chamadas pagas, chaves, dados reais, integrações Portal/CRM, leads, tickets ou cobranças.
