# Faísca R264 — concorrência HTTP com reservas duráveis

**Escopo:** prova executável, exclusivamente em laboratório privado, da composição R95 + R82 + R263 sob requisições concorrentes. Sem credencial OpenAI, dados de cliente, servidor externo ou ação operacional.

## Cenário

O teste `tests/faisca-r264-private-http-singleflight-durable.test.mjs` inicializa o servidor R95 em `127.0.0.1`, usa o ledger durável R82 em diretório descartável com permissão `0700` e injeta um transporte local de respostas Luna/Terra. A primeira chamada fica retida **após** adquirir uma reserva e o marcador de despacho.

Enquanto Luna está retida, o teste envia, em HTTP real, uma segunda conversa autenticada, uma requisição anônima e uma pergunta contendo um endereço `.invalid` fictício. Espera, respectivamente, HTTP `429 busy`, `403 forbidden` e `400 invalid_question`. Nenhuma pode entrar no transporte simulado ou consumir reserva adicional. Uma única reserva permanece durante o bloqueio.

Ao liberar Luna, o servidor pode concluir Terra e responder à primeira conversa: exatamente dois despachos simulados, `store:false`, `tools:[]`, sem disponibilidade pública nem efeitos operacionais. Após `finish` HTTP e encerramento ordenado, outro objeto ledger lê as duas reservas persistidas e recusa nova capacidade. A verificação percorre os arquivos do ledger procurando perguntas, respostas, endereços fictícios e tokens: nenhum conteúdo sensível deve estar presente.

## Execução

```sh
node --test tests/faisca-r264-private-http-singleflight-durable.test.mjs
```

A CI da PR draft executa o conjunto Node/HTTP, Chromium/axe/WCAG, SEO/build, Onepage/Portal, PostgreSQL descartável e PHP. Revalidar na HEAD exata antes de considerar o incremento pronto.

## Limites e gates

- Uma reserva local é **teto de despacho do laboratório**, não conciliação externa com fatura/usage da OpenAI nem garantia de gasto em produção.
- O teste não demonstra qual imagem/processo atende a VPS, não instala R95 e não substitui a homologação humana de staging ou a revisão AppSec/LGPD/FinOps/editorial.
- A homologação R92 e os testes pagos Luna/Terra relatados pelo operador não são repetidos.
- Nenhuma alteração em `main`, no site público, no mascote aprovado, no Portal/Sites, na VPS/DNS ou em `publicFaiscaEnabled=false`. **Sem GO público.**
