# Faísca R198 — barreira entre conclusão da API e resposta HTTP privada

## Contexto

A R196 cria um marcador durável exclusivo por host antes do despacho pago e o libera depois da resposta upstream validada. Havia uma janela entre esse retorno e o envio da resposta HTTP: outro processo poderia iniciar uma requisição antes de o primeiro servidor detectar uma desconexão do operador.

A R198 passa a **reutilizar o mesmo marcador O_EXCL** durante Luna e Terra e só o libera após o evento `finish` da resposta HTTP privada. `ready()` e `reserve()` de outros objetos/processos continuam NO-START nesse intervalo. Enquanto o ACK local não termina, o mesmo processo também recusa outra execução. Se houver morte abrupta entre o retorno da API e o `finish`, o marcador previamente fsynced persiste e impede nova execução até reconciliação humana. Erros de entrega continuam usando o latch persistente R194/R195.

O modo CLI independente ainda libera após retorno upstream validado (sem browser), mas o navegador de revisão privada sempre pede `requireHttpDeliveryAck:true`. Os testes usam `node --test tests/faisca-r198-http-finish-durable-dispatch.test.mjs`: comprovam duas chamadas simuladas Luna/Terra sob um único marcador, recusa de outra reserva, ACK manual e duas conversas HTTP sequenciais em loopback com reservas acumuladas sem cobrança real.

## Limites

`res.finish` prova apenas a conclusão de escrita do lado servidor, **não** a leitura confirmada pelo navegador. Não é ACK humano, nem recibo independente de custo; um cliente pode perder bytes após o servidor escrever. A trava continua exclusivamente local a um host e sistema de arquivos; não há coordenação entre VPS/hosts múltiplos, nem política operacional de remoção do marcador. Uma falha ao persistir marcador ou ao liberar continua NO-START; qualquer reconciliação exige operador responsável.

R92 e testes pagos anteriormente relatados não foram repetidos. Não há evidência de que R95–R198 esteja instalada na VPS. Os testes utilizam somente mensagens e provedores fictícios, sem chaves reais.

**REVIEW-ONLY / NO-GO público**: preservar `main`, mascote, site público e `publicFaiscaEnabled=false`; sem deploy, merge, DNS, integração CRM/Portal/Sites operacional, leads, tickets ou cobranças. Gates: CI Node/HTTP/Chromium/axe/SEO/PHP/PG na HEAD exata, homologação em staging privado isolado e revisão independente AppSec/LGPD/FinOps/editorial.
