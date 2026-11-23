# Faísca R267 — queda abrupta do processo durante despacho HTTP privado

R267 amplia o teste de dois processos da R266 para uma **falha de processo real**: o subprocesso Node está atendendo uma requisição HTTP autenticada fictícia; sua primeira chamada de transporte simulado Luna é suspensa, depois o processo recebe `SIGKILL` antes de haver resposta ou confirmação de entrega HTTP.

O teste registra o estado durável com uma reserva e prova que o marcador `.faisca-provider-dispatch-inflight` permanece após o encerramento abrupto. Dois servidores HTTP sucessivos, com novos objetos ledger e transportes simulados, devem retornar `503` genérico, com `403` anônimo, **zero novas invocações** ao provedor, exatamente o mesmo arquivo de reservas e nenhuma gravação de pergunta, resposta ou tokens. O marcador exige revisão humana; não há TTL, limpeza automática ou reembolso presumido.

## Teste

```sh
node --test tests/faisca-r267-private-http-crash-no-replay.test.mjs
```

O subprocesso é iniciado com `fork` em ambiente reduzido usando a fixture privada da R266. Nenhum dado real, chave OpenAI verdadeira, acesso à VPS, conexão com Portal/Sites/CRM, chamada paga ou faturamento é envolvido. A comunicação HTTP se restringe a `127.0.0.1`. A prova de reinício recria o listener em laboratório, **não reinicia Docker na VPS**.

## Limites e gates

A CI Node/HTTP/Chromium/axe/WCAG, SEO/build, Portal/Onepage, PostgreSQL efêmero e PHP deve ser confirmada na HEAD exata. Este ensaio não substitui reconciliação externa de despesas OpenAI, demonstração do processo/container responsável pelo staging instalado nem validação multi-host. R92 e o teste real pago relatados pelo operador permanecem respeitados, sem repetições; R95 e os incrementos seguintes não são presumidos instalados.

As revisões independentes AppSec/LGPD/FinOps/editorial e a correlação Docker → PID/listener → HTTP autenticado no staging são gates ainda fechados. Sem merge, deploy, DNS/VPS, dado real, lead, cobrança, ticket ou GO público. Preservar `main`, site, mascote aprovado e `publicFaiscaEnabled=false`.
