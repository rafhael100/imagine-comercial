# Faísca R266 — dois processos HTTP e cerca durável de despacho

## Objetivo e diferença em relação a R264–R265

R264 exercitou duas requisições concorrentes no mesmo processo HTTP. R265 manteve um marcador previamente criado por outro objeto ledger. **R266 executa um servidor HTTP real em um subprocesso Node separado**, mantém a primeira chamada sintética Luna suspensa na barreira de transporte e tenta iniciar outra conversa autenticada em um segundo listener, no processo principal, compartilhando apenas o diretório de reservas `0700`.

O segundo processo deve devolver **HTTP 503** com envelope genérico, zero chamadas ao provedor simulado e nenhuma reserva extra. Em paralelo, uma tentativa anônima deve devolver **403**. Depois da liberação explícita da fixture, a primeira requisição termina com resposta geral fictícia e com exatamente duas reservas duráveis (Luna/Terra). São proibidos texto da conversa, resposta, tokens e credenciais fictícias nos arquivos persistidos.

## Execução independente

```sh
node --test tests/faisca-r266-private-http-two-process-fence.test.mjs
```

O teste utiliza `child_process.fork` com ambiente reduzido e transporte OpenAI **inteiramente injetado**. Não depende de VPS, credenciais de produção, serviços Portal/Sites, tráfego externo, faturamento, dados reais ou publicação do mascote. A fixture auxiliar não é um servidor público e só aceita HTTP em `127.0.0.1`.

### Evidências e limites

- CI Node/HTTP, Chromium/axe/WCAG, SEO/build, Portal/Onepage, PostgreSQL efêmero e PHP precisam ser conferidos **na HEAD exata** desta PR.
- O marcador `O_EXCL` representa coordenação local; um diretório compartilhado por múltiplos hosts, um volume em rede e isolamento de containers não estão cobertos.
- A prova não reconcilia cobranças reais e não demonstra a identidade da imagem Docker ou o processo atendendo o staging da VPS.
- R92 homologada e os testes pagos Luna/Terra relatados pelo operador não são repetidos. R95 e R266 **não estão comprovadamente instaladas** na VPS.
- Sem merge, deploy, mudança DNS/VPS, operações reais de CRM/Portal/Sites ou GO público. Manter `publicFaiscaEnabled=false`, `main` e o mascote/site público intactos.

## Gates pendentes

Correlacionar digest da imagem Docker com PID/listener/HTTP autenticado do staging privado por evidência operacional independente; conciliar despesas/reservas com prova externa do provedor sem expor dados; obter revisões AppSec, privacidade/LGPD, FinOps e editorial e decisão humana separada para qualquer abertura pública.
