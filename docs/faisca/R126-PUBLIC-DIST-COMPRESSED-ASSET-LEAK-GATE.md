# Faísca R126 — impedir leakage de artefatos privados em bundles comprimidos

## Lacuna
A R125 inspeciona todos os arquivos do pacote público, mesmo com extensões incomuns, mas marcadores ASCII ficam opacos após gzip/Brotli. Um arquivo `bundle.js.gz` ou `bundle.js.br` contendo o endpoint `/__faisca_openai_private/converse` poderia atravessar o gate público sem alerta.

## Incremento
- Decomprimir um nível de todo arquivo com extensão exata `.gz` ou `.br`, no processo local de auditoria, usando APIs nativas Node com limite rígido de 12 MiB de saída por arquivo.
- Falhar fechado para compressão inválida/oversized e para marcadores privados no conteúdo descomprimido.
- Validar UTF-8 estrito no payload de extensões web conhecidas antes da compressão, além das checagens R124–R125 em bytes crus, sem consultar rede.
- Testes sintéticos Node: gzip, Brotli, controle positivo editorial, corrupção, expansão acima do limite e UTF-8 inválido. Executar `node --test tests/faisca-r126-public-compressed-private-leak.test.mjs`, `npm test`, build, auditor do dist e testes Chromium/axe/HTTP/Portal/SEO da CI.

## Limitações e segurança operacional
A inspeção cobre uma camada de gzip/Brotli identificada por extensão; não prova ausência de outros formatos, payloads codificados, arquivos criptografados ou segredos. Não é DLP completo nem autorização de staging/prod. Não registrar dados reais, chaves ou payloads sensíveis.

R92 homologada por relato do operador; versões R95+ não presumidas instaladas na VPS. Preservar `main`, o site público, o mascote aprovado e `publicFaiscaEnabled=false`. Nenhum deploy, merge, DNS/VPS, OpenAI paga, Portal/CRM operacional, lead, ticket ou cobrança.
