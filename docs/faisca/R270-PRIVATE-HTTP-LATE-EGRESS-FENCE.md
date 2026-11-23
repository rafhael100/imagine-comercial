# Faísca R270 — segunda verificação de cerca na saída HTTP (DRAFT)

## Problema tratado

A R269 #749 detectou e corrigiu a emissão de HTTP 200 depois de um segundo processo registrar incerteza **durante Terra**. A checagem da R269 ocorre no adaptador de API, depois da resposta do provedor. Ainda havia uma janela entre o processamento editorial da resposta no servidor HTTP e a chamada a `res.end()`.

R270 adiciona uma verificação somente leitura de `assertPaidDispatchStillValid()` **no servidor HTTP, após `safeReviewOutput` / `safeConversationOutput` e antes de construir/enviar o HTTP 200**, por `lab.assertPrivateHttpDeliverySafe()`. Se outro worker tiver gravado o marcador NO-START, o servidor responde **503 genérico** em vez de 200, preserva todas as reservas e mantém a incerteza durável. Não há retry, reembolso ou limpeza automática de marcadores.

A API do lab continua privada; as respostas editoriais fixas sem chamadas pagas não necessitam de marcador de despacho. Em ambientes com despacho durável, a ausência da capacidade de verificar o marcador implica falha conservadora.

## Regressão executável

```sh
node --test tests/faisca-r270-private-http-late-egress-fence.test.mjs
```

O teste percorre **Luna e Terra simuladas**, ambas com `store:false` e sem rede externa, usando HTTP de loopback do servidor real. Exercita:

- Caminho normal: duas reservas persistidas, HTTP 200 de conversa fictícia, liberação do marcador após `finish`, sem efeito operacional.
- Injeção adversarial: um segundo objeto ledger grava NO-START **depois de Luna/Terra e da validação editorial, imediatamente antes da última conferência HTTP**. Exigir HTTP 503, duas reservas preservadas, zero retries, bloqueio de novo despacho, sem texto, token ou credencial de teste nos arquivos.
- Em ambos os casos, acesso anônimo recebe 403, nenhuma origem CORS recebe autorização, resposta não pode ser cacheada e o resultado nunca equivale a aprovação pública.

## Limites e gates

A última leitura e o envio do primeiro byte **não são atômicos**: um marcador criado após essa checagem ainda pode não ser observado. O objetivo é estreitar e testar a janela, não alegar garantia criptográfica de entrega ou transação distribuída. `finish` não demonstra leitura da resposta pelo operador. A decisão de introduzir transação/gateway separado exige revisão AppSec e especificação da semântica HTTP/ledger.

Validar na HEAD exata os seis workflows do GitHub (Node/HTTP; Chromium/axe/WCAG; SEO/build; Onepage/Portal; PostgreSQL descartável; PHP) e revisão de segurança. A R95 não foi presumida instalada na VPS; R92 e os testes pagos Luna/Terra manuais não foram repetidos. Nenhum acesso a credenciais, mensagens reais, produção, CRM/Portal/Sites, deploy, merge, DNS, VPS ou cobrança. `main`, mascote, site público e `publicFaiscaEnabled=false` permanecem protegidos.

**NO-GO público.** A conciliação independente de uso/custos, o vínculo processo Docker–socket–HTTP no staging real, e as revisões AppSec/LGPD/FinOps/editorial continuam pendentes.
