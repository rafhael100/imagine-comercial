# Faísca R230 — manifesto de staging privado com leitura limitada

## Problema
O validador do kit R38 carregava `Faisca_R38_MANIFEST.json` usando `readFile()` sem limite de tamanho **antes** de validar o teto de arquivos e bytes do kit. Um manifesto malicioso (não incluído na lista de hashes do próprio manifesto) podia provocar consumo de memória arbitrário mesmo que nenhum ativo público ou privado estivesse alterado.

## Correção
Novo leitor de manifesto: `open()` com `O_RDONLY | O_NOFOLLOW | O_NONBLOCK`, tamanho entre 64 bytes e **128 KiB**, apenas arquivo regular com um único link, leitura posicional limitada, conferência de inode/tamanho/tempo de modificação antes/depois e `TextDecoder` UTF-8 fatal. As políticas de conteúdo e a verificação de manifesto R38/R229 permanecem inalteradas.

Testes sintéticos cobrem o kit positivo existente, manifesto válido preenchido com espaços até 256 KiB, link simbólico de manifesto e byte UTF-8 inválido. São somente arquivos temporários de laboratório, sem credencial ou contato com a VPS.

```bash
node --test tests/faisca-r38-private-staging-kit.test.mjs
npm test
npm run test:browser
```

**Limites:** inspeção offline não comprova origem do manifesto nem operação em staging. Exige revisão independente da HEAD, conferência Nginx `-T` por operador, HTTP/Chromium/axe na VPS quando operacionalmente autorizado, reconciliação de gastos e revisões AppSec/LGPD/FinOps/editorial. Não altera site público, mascote, `main` ou `publicFaiscaEnabled=false`. Sem deploy/merge/DNS, OpenAI paga, dados reais ou integração operacional Portal/Sites. **NO-GO público**.
