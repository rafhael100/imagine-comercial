# Faísca R125 — vedação de marcadores privados em qualquer artefato do dist público

## Defeito comprovável
A R124 #599 restringia a leitura de marcadores privados ao conjunto de extensões HTML/JS/CSS/JSON/XML/TXT/webmanifest/map. Um arquivo com extensão `.mjs`, `.svg`, `.log`, `.cache`, `.dat` ou um binário com bytes ASCII que incluísse `/__faisca_openai_private/` passava pelo audit se o caminho não fosse proibido e o SHA não coincidisse com o PNG mestre.

## Correção
O auditor público `auditPublicFaiscaDist` agora examina **todos os arquivos** como sequência de bytes mapeados em Latin-1, preservando os padrões ASCII anteriores e a detecção sem distinguir maiúsculas/minúsculas. Arquivos de extensões web textuais continuam sujeitos à decodificação UTF-8 estrita; limites de bytes, arquivos, symlinks e paths permanecem inalterados. Não se altera conteúdo de páginas públicas nem se ativa interface OpenAI.

`node --test tests/faisca-r125-public-opaque-private-leak.test.mjs` usa apenas arquivos sintéticos temporários: casos negativos em MJS/SVG/LOG/DAT/WASM/cache aninhado, caso positivo com imagem binária sem marcador e menção editorial legítima ao Faísca e regressão de UTF-8 malformado. Executar também `npm test`, `npm run build`, QA Chromium/axe e o auditor de `dist` no CI.

## Limites e gates
É uma varredura lexical para *marcadores privados em claro*; não encontra conteúdo codificado, comprimido ou sem marcadores, nem certifica ausência de credenciais ou privacidade. Não substitui revisão humana da árvore compilada, controle de artefatos ou homologação separada do laboratório privado.

A R92 foi homologada segundo o operador. **Nenhum teste deste PR implica instalação de R95–R125 na VPS.** Não realizar merge/deploy, configurar DNS, acionar Portal/CRM, chamadas pagas, dados reais, tickets, leads ou cobranças. Preservar `main`, `publicFaiscaEnabled=false`, mascote aprovado e site público.
