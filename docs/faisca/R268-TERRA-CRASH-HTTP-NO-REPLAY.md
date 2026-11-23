# Faísca R268 — crash durante Terra, sem replay nem reembolso (DRAFT)

## Incremento e escopo

R267 #747 ensaiou SIGKILL enquanto a **primeira** chamada Luna ainda estava suspensa. R268 exercita o caso mais caro e arriscado: **Luna concluída; reserva Terra já persistida; transporte Terra suspenso; SIGKILL antes do ACK HTTP**. Usa o servidor real de laboratório em `127.0.0.1`, duas reservas reais do ledger local em diretório descartável `0700` e respostas de IA inteiramente simuladas.

O teste de R268 estende a fixture compartilhada de R266 com argumento opcional `second`. Sem esse argumento, seu comportamento permanece idêntico para R266/R267. Nenhum código de produção, configuração, site público ou imagem do mascote é alterado.

## Evidência reproduzível

```sh
node --test tests/faisca-r268-private-http-terra-crash-no-replay.test.mjs
```

Asserções: duas reservas persistidas antes da falha, marcador durável de despacho ainda presente, dois listeners reiniciados em sequência retornando **403 sem token** e **503 autenticado**, **zero** novas chamadas ao adaptador de IA simulado, estado de reservas idêntico byte a byte antes/depois, resposta HTTP genérica com `Cache-Control: no-store` sem CORS e arquivos sem pergunta, token ou credencial fictícia. `ready()` continua bloqueado e `inspectReadOnly()` não afirma conciliação externa.

Executar na HEAD exata os seis workflows GitHub Actions (Node/HTTP/Chromium/axe/WCAG, SEO/build, Portal/Onepage, PG descartável, PHP R05 e PHP R06) e anexar resultados à PR. Qualquer falha exige correção na própria branch isolada, sem merge ou deploy.

## Limites de confiança e próximos gates

A fixture simula as duas respostas, não consulta a OpenAI, não prova os gastos reais e não identifica processo Docker, digest da imagem ou listener da VPS. O teste não autoriza revisão/limpeza automática de marcadores: a liberação exige reconciliação e decisão humana independente. Diretório local com `O_EXCL` não oferece exclusão distribuída multi-host.

R92 e chamadas pagas Luna/Terra anteriormente relatadas pelo operador **não são repetidas**. R95 e cadeia acumulada até R268 **não estão comprovadamente instaladas no staging da VPS**. Continuam pendentes correlação operacional Docker → PID/listener → HTTP, conciliação com evidência independente de consumo, revisões AppSec/LGPD/FinOps/editorial e homologação de conversa fictícia na instalação efetiva.

`main`, site público, mascote aprovado e `publicFaiscaEnabled=false` permanecem inalterados. Sem chaves, dados reais, operações Portal/Sites/CRM, geração de cobrança/lead/ticket, alteração VPS/DNS, deploy, merge ou GO público.
