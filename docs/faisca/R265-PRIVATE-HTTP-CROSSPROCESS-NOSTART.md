# Faísca R265 — NO-START HTTP entre processos

## Escopo

Teste executável de uma instância R95 servindo HTTP em loopback quando **outro worker** já detém o marcador durável de despacho da R82. É uma prova de laboratório, exclusivamente sintética, usando duas instâncias independentes do ledger no mesmo diretório descartável `0700`. O marcador simula um despacho ainda não reconciliado; nenhuma chamada real é realizada.

O servidor HTTP deve retornar `503 unavailable` na primeira tentativa autenticada de conversa e continuar bloqueado para uma repetição, sem executar o `fetchImpl` injetado (0 chamadas Luna/Terra) e sem registrar reserva nova. Requisições sem token continuam `403`. Mesmo após encerrar a instância HTTP, outro objeto ledger deve manter o NO-START, exigindo revisão humana, sem textos de conversa, credenciais ou detalhes de exceções nos arquivos persistidos.

## Teste

```sh
node --test tests/faisca-r265-private-http-crossprocess-no-start.test.mjs
```

A validação cumulativa da PR deve incluir os seis workflows Node/HTTP/Chromium/axe/WCAG/SEO/Onepage/PG/PHP na HEAD exata.

## Limites

O teste protege uma situação de marcador previamente adquirido, mas não substitui ensaios de crash/recovery, conciliação independente da fatura e uso da OpenAI, nem demonstra o processo ou imagem Docker responsável pelo staging instalado. Nem R95 nem esta cadeia foram comprovadas como implantadas na VPS. R92 e testes pagos reais previamente relatados não são repetidos.

Não realizar merge, deploy, mudanças VPS/DNS, acesso a chave, operação Portal/Sites/CRM nem GO público. Preservar `publicFaiscaEnabled=false`, o mascote aprovado e o site comercial público.
