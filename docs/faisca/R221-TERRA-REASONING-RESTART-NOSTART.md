# R221 — Recibo contraditório de Terra no Chromium privado

## Escopo de laboratório
Complementa o ensaio R220 com um terceiro cenário **após a segunda chamada sintética**. R219 já verifica no adaptador que `output_tokens_details.reasoning_tokens` não pode exceder `output_tokens`; R220 ensaiava somente êxito e `cached_tokens` contraditório de **Luna** no Chromium. Esta entrega fecha a lacuna de regressão HTTP/navegador/ledger **quando Terra já foi despachada**.

## Teste executável
`node ops/faisca/openai/private-token-details-browser-qa.mjs`, acionado pelo workflow `faisca-guided-lab.yml` após a instalação de Chromium:

- **Sucesso sintético:** exatamente duas chamadas Luna/Terra, recibos coerentes, resposta fictícia exibida, campos e storage vazios.
- **Luna incoerente:** `cached_tokens=181 > input_tokens=180`, um despacho reservado, HTTP 503, resposta segura, Terra não chamada, marca durável NO-START.
- **Terra incoerente:** Luna válida, Terra reporta `reasoning_tokens=36 > output_tokens=35`. Exige exatamente duas reservas preservadas, HTTP 503 sem mostrar texto de Terra, NO-START persistente e nenhuma chamada adicional após reinício e novo POST de teste.
- Nos três cenários: uma única submissão do navegador por tentativa, tráfego apenas em loopback, `store:false`, sem ferramentas, token/pergunta apagados, sem cookies/localStorage/sessionStorage e axe WCAG 2.1 A/AA.

A asserção de **duas** reservas após o erro de Terra distingue esta falha da rejeição anterior em Luna; nenhuma reserva é devolvida por incerteza de cobrança. Nenhuma chave real é acessada ou persistida.

## Evidência e limites
Este é um teste com Responses **simuladas** e HTTP/Chromium reais em runner efêmero. Não atesta saldo, invoice, resposta de modelo real, revisão editorial independente, instalação R95–R221 na VPS ou publicação. Os testes pagos e homologação R92 já relatados não são repetidos. O operador continua responsável por conciliação externa e homologação privada acumulada.

**NO-GO público:** branch isolada, PR draft sobre R220, sem merge/deploy/VPS/DNS, sem CRM/Portal/Sites operacionais, cobrança, lead ou ticket. Preservar `publicFaiscaEnabled=false`, site público e mascote aprovado.
