# Faísca R188 — reserva durável com confirmação ambígua (privado)

## Correção
O laboratório direto Luna/Terra já contabiliza reservas antes do despacho e,
desde R187, impede novo despacho após resultado incerto do provedor.
Uma falha da chamada `reservationLedger.reserve()` podia ocorrer **após**
persistir a reserva, mas **antes** de devolver confirmação ao processo.
Nessa situação, repetir uma pergunta causaria nova reserva, mesmo com a
primeira operação persistida e sem nenhuma chamada à API.

Agora uma rejeição ou exceção de `reserve()` bloqueia **a instância inteira**
do laboratório: a próxima pergunta não invoca novamente a reserva nem
`fetchImpl`, e a mensagem de erro devolvida é genérica. Não estorna nem
pressupõe que a persistência falhou; operador deve reconciliar o ledger por
via privada e independente antes de iniciar outra sessão.

## Provas sintéticas
`node --test tests/faisca-r188-ambiguous-ledger-reservation.test.mjs`

- Gravação simulada concluída seguida de perda de confirmação: sem rede e sem
  segunda reserva, erro sem texto interno.
- Reserva rejeitada antes da gravação: também falha fechada.
- Reserva confirmada: uma resposta Luna válida continua funcionando com
  `store:false`, sem Terra nem dados reais.

## Limites / NO-GO
O bloqueio fica **na memória do processo**; reinícios demandam revisão
separada do ledger. Não é conciliação independente com faturamento da OpenAI,
não comprova staging/VPS, nem substitui o bloqueio HTTP ou review AppSec.
Os testes pagos Luna/Terra e a homologação R92 relatados pelo operador não
são repetidos. A integração R95+ não tem instalação comprovada na VPS.

Somente branch isolada / PR draft. Não alterar `main`, mascote aprovado,
site público, `publicFaiscaEnabled=false`, DNS/VPS, Portal/CRM/Sites,
ativação pública, billing ou dados reais.
