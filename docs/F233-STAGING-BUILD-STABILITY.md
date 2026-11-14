# F233 — Estabilidade do pacote durante diagnóstico do staging

O diagnóstico único F167/F232 já valida hash SHA-256 do diretório `dist` contra um valor esperado por canal independente **antes** das verificações HTTP. Esta etapa exige uma **segunda validação após a revisão autenticada integral das rotas**.

## Contrato
1. Verificar sintaxe de imagem com digest, integridade integral do `dist` e arquivo privado bcrypt.
2. Inspecionar todas as rotas atuais e as 27 rotas históricas em `127.0.0.1`, sem deploy nem requisições externas.
3. Voltar a calcular integridade SHA-256 de todos os arquivos, com o mesmo SHA esperado; rejeitar alterações ocorridas durante a sessão.
4. Se a validação passou, relatar `buildTreeBytesStableAfterHttp: true` e **continuar com `deploymentAuthorized:false`**.

Teste automatizado altera `dist/index.html` artificialmente enquanto a revisão HTTP sintética está em execução; o verificador recusa o resultado. Não envia a árvore/hash/credenciais para logs públicos.

**Limitação:** verificar `dist` antes e depois não autentica os bytes efetivamente servidos pela VPS, nem garante ausência de mudanças transient/externas; é uma barreira adicional contra deriva acidental ou manipulação local. Ainda é obrigatório comprovar a montagem de volume correto, imagem auditada, rede privada/TLS, identidade, Portal/CRM, SEO e aprovação de produção.
