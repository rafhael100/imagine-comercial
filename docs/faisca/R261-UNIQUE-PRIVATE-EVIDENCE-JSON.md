# R261 — JSON de inspeção privada sem chaves duplicadas (DRAFT)

Base revisada: R260 #739, commit `315777a4927cef20bec017f70cb7974694d4929f`.

## Motivo

`JSON.parse` aceita membros de objeto duplicados e mantém somente o último.
Em evidências relatadas pelo operador (`docker inspect`), isso pode permitir
que ferramentas diferentes interpretem uma mesma entrada de maneiras diferentes.
A R261 recusa ambiguidades antes de executar quaisquer verificações HTTP.

## Mudança

- O CLI `scripts/faisca-review-two-listener-boundary.mjs` utiliza agora
  `parseUniquePrivateEvidenceJson` após o limite existente de stdin
  (512 KiB, UTF-8 fatal, prazo absoluto de 3 s).
- A verificação percorre todos os objetos aninhados e arrays, recusando nomes
  duplicados inclusive quando codificados via escapes JSON Unicode. Nomes iguais
  em *objetos distintos* continuam válidos.
- Defesa adicional contra entradas patológicas: profundidade máxima 64 e
  4.096 membros por objeto. O parser JSON nativo continua responsável por
  validar a sintaxe. O parser não executa código nem faz I/O.
- Exceções não são impressas pelo CLI: permanecem `HOLD`, saída 2 e ausência
  de eco do conteúdo de inspeção.

## Testes

`node --test tests/faisca-r261-unique-operator-json.test.mjs`

Abrange JSON sintético de inspeção, duplicatas em raiz e subobjetos,
escapes Unicode, pares de objetos distintos, profundidade, entradas malformadas
e execução do CLI sem vazamento de fixture. A CI completa do repositório
permanece gate da PR na HEAD exata.

## Limites

Esse controle valida apenas a **representação de entrada**. Não prova que a
inspeção veio do Docker da VPS, que o processo inspecionado realmente serve
os listeners 4337/4336, que R95 esteja instalada, que a conversa privada
autenticada funcione ou que gastos pagos tenham sido conciliados. A R92 e
os testes pagos Luna/Terra anteriormente relatados não são repetidos.

**NO-GO público**: nenhuma alteração em `main`, no site/mascote,
`publicFaiscaEnabled=false`, VPS, DNS, credenciais, CRM/Portal/Sites,
pagamentos, leads ou tickets. Sem merge ou deploy. Revisões independentes
AppSec/LGPD/FinOps/editorial e homologação operacional continuam pendentes.
