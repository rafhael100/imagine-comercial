# F293 — Bloqueio real de caminhos reservados em staging privado

A configuração `ops/staging/nginx.conf` declara bloqueio para arquivos e pastas internas. A F293 verifica isso por **HTTP real em loopback**, e compara o corpo de cada 404 com o **`dist/404.html` previamente validado por SHA-256 independente**. Uma resposta com status 404 mas corpo contendo segredo é **reprovada**.

## Operação futura somente com acesso autorizado

Com contêiner já inicializado manualmente, túnel/loopback revisados e todas as variáveis privadas fornecidas pelo operador fora do Git:

```bash
IMAGINE_PRIVATE_STAGING_REVIEW=1 node scripts/check-private-staging-reserved-routes.mjs --port=4321
```

Pré-requisitos: `IMAGINE_STAGING_REVIEW_PASSWORD` (senha privada), `IMAGINE_EXPECTED_STAGING_TREE_SHA256` (pin independente do pacote) e `dist/` legível. O comando é **bloqueado no GitHub Actions** e não inicia Docker, não altera DNS ou firewall, não grava respostas e não usa dados reais.

O diagnóstico testa seis caminhos fixos de risco: `/.env`, `/.env.local`, `/.git/config`, `/.github/workflows/ci.yml`, `/_redirects`, `/_headers`, cada qual com GET anônimo e GET autenticado. O anônimo pode resultar em 401 com desafio Basic ou em 404 com corpo idêntico ao fallback revisado. O autenticado **deve** responder 404 com conteúdo HTML byte a byte igual ao artefato pinado. Todos devem emitir noindex, nofollow, no-store, cabeçalhos de segurança e nenhum cookie, redirect ou CORS permissivo.

A saída contém apenas contagens: seis caminhos, seis proteções anônimas, seis 404 autenticados correspondentes ao pacote. **Nunca** revela senha, valor de `.env`, cabeçalhos recebidos, caminhos locais, IP do servidor, URLs de terceiros ou trechos do corpo.

## Cadeia única de homologação

A F293 integra a sexta etapa do diagnóstico F258: pacote privado, Docker em execução, Nginx carregado, GET/arquivos/bytes, métodos HEAD/escrita e **rotas reservadas**. Qualquer falha interrompe a cadeia e permanece HOLD. A leitura dos arquivos do pacote e a revisão HTTP não são equivalentes à aprovação externa da origem do pin, MFA real, política de firewall/TLS, SEG/DBA/LGPD, SEO, integração do CRM ou autorização de publicação.

Os testes do GitHub usam somente respostas sintéticas e um servidor Node temporário em `127.0.0.1`. **Não validam o Nginx ou a VPS Leaseweb real.** Sem deploy, alteração `main`, DNS, 301 ou custos.
