# Faísca R269 — contenção entre processos durante Terra (DRAFT)

## Diferença para R266–R268

R266 cobriu dois processos enquanto a primeira chamada Luna estava em andamento; R267/R268 simularam queda abrupta durante Luna ou Terra. **R269 exercita concorrência ativa enquanto Terra está em andamento**, sem matar nenhum processo inicialmente. A primeira requisição já concluiu Luna e possui **duas reservas duráveis**, mas ainda não entregou resposta HTTP. Um segundo listener Node, com objeto de ledger e token distintos no mesmo diretório descartável `0700`, tenta iniciar outra conversa fictícia autenticada.

**Política conservadora atual:** o segundo listener retorna HTTP 503 sem consultar a IA, coloca marcador global de incerteza e bloqueia a primeira resposta também com HTTP 503. Preserva ambas as reservas e proíbe liberação, reembolso ou nova chamada até revisão humana. Esta política é intencionalmente indisponível sob concorrência; melhor distingui-la de contenção inofensiva exigiria alteração de protocolo e revisão AppSec. O teste documenta o contrato observado, não suaviza o bloqueio para obter CI verde.

## Ensaio executável

```sh
node --test tests/faisca-r269-private-http-two-process-terra-fence.test.mjs
```

Empilha-se sobre R268 #748 (fixture do worker com barreira opcional na segunda chamada). Confirma: duas reservas Luna/Terra; resposta 403 anônima e 503 autenticada ao segundo listener; **zero** chamadas ao provedor simulado pelo segundo listener; erro HTTP genérico sem CORS nem cache; primeiro listener responde 503 após liberação, com marcadores de incerteza/despacho persistidos; estado numérico de reservas inalterado byte a byte; arquivos sem textos de conversa, tokens ou chave fictícia. Nenhuma chamada OpenAI real.

## Gates

- Conferir os seis workflows Node/HTTP/Chromium/axe/WCAG/SEO/build/Onepage/PG/PHP na HEAD exata da PR.
- Revisão de AppSec obrigatória para qualquer mudança na política de contenção de múltiplos processos.
- Imagem Docker, PID, socket/listener e HTTP privado **na VPS efetiva** continuam não comprovados; testes de loopback em CI não são homologação de staging.
- Conciliação independente do consumo real, revisão LGPD/FinOps/editorial e decisão separada para qualquer GO.

R92 e os testes pagos Luna/Terra realizados manualmente não foram repetidos. Preservados `main`, identidade do mascote, site público e `publicFaiscaEnabled=false`. Sem segredos, dados reais, VPS/DNS, CRM/Portal/Sites, billing, lead, ticket, deploy ou merge. **NO-GO público.**
