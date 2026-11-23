# Faísca R277 — conversa privada R95, fence tardia e ledger real (DRAFT)

## Objetivo
R276 corrige a janela de troca dos hooks duráveis durante a espera assíncrona
da última fence HTTP. R277 prova a correção no caminho **R95 /converse**,
com o cliente Luna/Terra existente, ledger R82 em diretório 0700 e servidor
HTTP real de loopback. O transporte OpenAI é inteiramente simulado.

## Contrato de teste
```sh
node --test tests/faisca-r277-private-conversation-late-fence-ledger.test.mjs
node --test tests/faisca-r276-async-durable-fence-race.test.mjs
npm test
```

- Autenticação ausente e entrada com e-mail fictício são rejeitadas antes
  de qualquer reserva/chamada.
- A pergunta sintética válida passa por Luna e Terra simulados,
  `store:false`, `tools:[]`, sem retry automático.
- O adaptador delega ao ledger real, mas altera o hook de confirmação
  enquanto a verificação final assíncrona está suspensa.
- A resposta retorna HTTP 503 sem CORS nem vazamento de texto; o hook
  substituto não é executado.
- Duas reservas permanecem, com bloqueio NO-START durável e nenhum novo
  despacho após o erro. Nenhum arquivo contém pergunta, resposta,
  token ou credencial sintética.
- Revisar seis workflows de CI na HEAD exata, incluindo Chromium/axe/WCAG,
  Node/HTTP, SEO/build, Portal/Onepage, PostgreSQL efêmero e PHP.

## Interpretação
O resultado verifica **falha segura em laboratório com o caminho real de código**,
não gasto real, uso autenticado de OpenAI, funcionamento da VPS, entrega
efetiva ao navegador do operador ou atomicidade de entrega em múltiplos hosts.
A reconciliação financeira independente, observação Docker/PID/HTTP no staging
e revisões AppSec/LGPD/FinOps/editorial continuam pendentes.

Respeitar homologação R92 e teste pago manual Luna/Terra já relatados, sem
repeti-los. Nenhum dado real, chave acessada, ação CRM/Portal/Sites,
merge, deploy, cobrança ou alteração DNS/VPS foi executado.
Preservar `main`, mascote e site público, com
`publicFaiscaEnabled=false`. **NO-GO público.**
