# Faísca R204 — trava por uso do provedor acima da reserva privada

## Motivação

O laboratório privado faz uma reserva conservadora **antes** de cada envio para Luna ou Terra, considerando os bytes do payload e o limite `max_output_tokens`. A R203 validava o tipo e os valores não negativos de `usage`, mas ainda tratava como conclusão saudável uma resposta que declarasse mais tokens consumidos do que a própria reserva havia previsto. Isso não é prova de cobrança real, mas é uma inconsistência crítica para FinOps.

## Contrato R204

- Após verificar modelo, status, JSON, resposta e `usage`, compare `input_tokens` com `ceil(bytes(payload)*1.5)+256` e `output_tokens` com `max_output_tokens` daquele despacho.
- Qualquer excesso **falha fechado** na própria API privada: sem repetir, sem reembolso automático, sem prosseguir para o segundo modelo e sem liberar a trava durável. O fluxo existente registra resultado incerto para reconciliação humana. A mensagem HTTP é opaca (503).
- Não se aumenta o limite experimental; não se compara `usage` declarado com fatura real; não se salva pergunta, resposta, token de autenticação ou chave no ledger.
- Testes inteiramente sintéticos comprovam excesso de input em Luna e excesso de output em Terra por HTTP de loopback, NO-START após reinício, reserva preservada, nenhum vazamento e caminho saudável de duas respostas.

## Validação

```sh
node --test tests/faisca-r204-provider-usage-reservation.test.mjs
npm test
npm run test:browser
```

Ainda são obrigatórias CI completa na HEAD exata, homologação acumulada em staging privado, conciliação independente do consumo real e revisões AppSec/LGPD/FinOps/editorial. O teste pago manual Luna/Terra e a homologação R92 anteriormente relatados **não são repetidos**. A instalação da R95 e seguintes na VPS não está presumida.

**NO-GO público:** branch isolada, PR draft, `main`, site público, mascote e `publicFaiscaEnabled=false` preservados. Nenhum deploy, DNS, acesso a credenciais reais, operação CRM/Portal/Sites, lead, chamado ou cobrança.
