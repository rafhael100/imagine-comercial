# Faísca R193 — sequência privada acumulada com reservas duráveis

## Escopo testado

A nova prova executável `node --test tests/faisca-r193-cumulative-private-staging.test.mjs` compõe o contrato R95 de conversa fictícia com a sequência negativa/positiva R157, as verificações de assets privados R94, o ledger R82/R191 e a barreira de reinício R192, no **mesmo** diretório de ledger descartável.

O teste inicia servidor HTTP real em `127.0.0.1`, com token de fixture e chaves **textuais fictícias**, e injeta um transporte OpenAI local simulado. Primeiro exige uma pergunta privada rejeitada sem chamada ao modelo; depois uma pergunta fictícia aceita, com dois modelos simulados e exatamente duas reservas locais. Em seguida simula falha 503 do provedor, verifica o marcador durável de incerteza, encerra o servidor e demonstra que nova instância fica bloqueada sem segundo despacho.

A saída da auditoria não inclui o texto da pergunta, resposta, token ou chave de fixture. O contrato conserva `publicReady:false`, `operationalEffects:false`, `providerTransportVerified:false` e `ledgerReconciled:false`.

## Limites e gates

- **Não** é homologação na VPS, não utiliza a chave real, não mede o custo efetivo nem valida cobrança/retorno de uma chamada OpenAI.
- Nenhuma migração, merge, deploy, DNS, operação no Portal/CRM/Sites ou interface pública.
- A homologação R92 e o teste pago privado reportados pelo operador não precisam ser repetidos para esta verificação de CI.
- Para qualquer implantação futura: conferir HEAD/CI exatas, executar a sequência com staging isolado e credenciais somente sob custódia do operador autorizado, reconciliar uso com fonte independente e obter revisão AppSec/LGPD/FinOps/editorial.
- Não assumir que R95 ou R193 esteja instalada na VPS. Preservar `publicFaiscaEnabled=false`, `main`, site e mascote aprovados.

Relatório **somente de laboratório**; NO-GO público.
