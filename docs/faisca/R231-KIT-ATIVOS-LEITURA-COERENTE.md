# Faísca R231 — leitura limitada e snapshot coerente do kit privado

## Risco corrigido

No verificador R38/R230, os ativos eram submetidos a `stat()` antes de `handle.readFile()`. Um arquivo alterado durante a leitura podia crescer além do tamanho previamente verificado; a verificação também aceitava hardlinks para conteúdo alterável fora do kit. Depois do hash, o verificador **reabria** Nginx/Compose/HTML para inspecionar políticas: bytes inspecionados podiam diferir dos bytes hashados.

## Implementação

- `readBoundedKitFile` abre os ativos com `O_NOFOLLOW | O_NONBLOCK`, exige arquivo regular com **apenas um vínculo físico** (`nlink=1`), limita o tamanho pré-leitura a 12 MiB por arquivo e 180 MiB acumulados e executa leitura posicional limitada aos bytes observados. Estatísticas `dev/ino/size/mtimeNs/ctimeNs` são verificadas novamente após a leitura. Nenhum `readFile()` potencialmente ilimitado permanece no percurso dos ativos do kit.
- A única passagem de hash também captura os bytes já inspecionados de Nginx, Compose e página inicial. A verificação de proteções usa **esses mesmos bytes**, decodificados como UTF-8 estrito, sem segunda leitura vulnerável a TOCTOU.
- Testes sintéticos reproduzem hardlinks de arquivo estático e Nginx sem mudança de hash ou manifesto, bem como comentário Nginx com UTF-8 inválido e manifesto recalculado. Os testes existentes de autenticação, CSP, tamanho e symlink continuam necessários.

## Execução de laboratório

```bash
node --test tests/faisca-r38-private-staging-kit.test.mjs
npm test
npm run test:browser
```

## Limites e autorização

Hash autocontido não é atestado independente de origem. A proteção `stat` antes/depois não substitui a proteção contra mudanças durante uso posterior do kit nem um `nginx -T`/HTTP 401 observado na VPS. Ambiente privado R92 previamente homologado pelo operador não foi modificado; R95 não é presumida instalada. **Sem merge/main, deploy, chaves, chamadas pagas, dados reais, Portal/Sites operacional ou liberação do mascote público.** `publicFaiscaEnabled=false` continua obrigatório. Gates AppSec/LGPD/FinOps/editorial e conciliação externa permanecem abertos; **NO-GO público**.
