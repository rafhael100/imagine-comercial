# Faísca R93 — preflight de capacidade para resposta Luna + Terra (LABORATÓRIO)
  
## Falha reproduzida

Antes desta entrega, o preflight privado R89 declarava `READY_FOR_PRIVATE_OPERATOR_START` quando restava **uma** chamada no ledger durável. A jornada privada consome uma chamada de classificação Luna e, quando há receita editorial, outra de composição Terra. Nessa situação, a primeira chamada paga poderia ser consumida sem capacidade para iniciar a segunda. O mesmo ocorria quando restavam apenas microvalores irrelevantes de orçamento.

## Correção e provas

- `ledger.ready({requireCapacity:true,minimumRequests:2,minimumBudgetUsd:0.01})` passa a exigir espaço para **duas chamadas** e pelo menos **US$ 0,01 de reserva estimada** antes de indicar prontidão para iniciar a revisão.
- `ready` continua **somente leitura** e rejeita mínimos não inteiros, negativos, não finitos ou maiores que a política local. Nenhum saldo é restituído nem zerado.
- `tests/faisca-r93-private-paired-quota-preflight.test.mjs` verifica um único slot restante, orçamento insuficiente, limite exato, diretório limpo e recusa de mínimos inválidos, sem rede, segredos reais ou modelos.

## Limites e revisão independente

Este é **um pré-requisito de admissão**, não uma reserva transacional conjunta, nem limite do faturamento OpenAI. Outro processo ainda pode consumir capacidade após o preflight; cada requisição deve manter sua própria reserva atômica. Um erro depois de Luna continua podendo consumir parte da cota e requer conciliação conservadora. A margem US$ 0,01 é apenas piso de prontidão; **não garante** que todo input ou resposta caiba nessa estimativa.

Branch R93 derivada exatamente de R92 #566, `e07c1bf409cbeafc281e1955b293fc3189571a36`; preservar a R87 conversacional paralela #567 e reconciliar especificamente seus arquivos de HTTP, página, laboratório e staging sob revisão independente. Não habilitar o Faísca público nem inferir autorização para VPS, pagamento real, Portal, Sites, deploy ou merge. Permanecem necessárias revisão AppSec/FinOps, staging privado operado com SHA revisada, e homologação de identidade, contrato, aceite e recibos no Portal.
