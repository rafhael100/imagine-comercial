# Faísca R84 — prova POSIX com processos independentes

**Base:** R83 #556 HEAD `7e9fe13d95609a9843cf580ede8666596c291dd5`, R82 #555 e R81 #554. Exclusivamente laboratório privado, sem publicações ou credenciais.

## Lacuna observada
A R82 já testava dois adaptadores no mesmo processo e livro persistente entre reinstanciações, mas não tinha prova com **processos Node distintos** competindo sobre o lock do sistema operacional. A R84 acrescenta teste E2E de concorrência real local, sem fazer chamadas à API.

## Novo teste executável
`tests/faisca-r84-multiprocess-ledger.test.mjs` abre um diretório temporário privado 0700 e lança oito processos Node independentes, com ambiente minimizado, para disputar exatamente uma reserva de API. Exige um único vencedor e sete negativas, contador durável igual a 1 e novo processo pós-reinício recusado. Em outro cenário, um lock remanescente simula crash e bloqueia novo processo sem criar contador.

Executar `node --test tests/faisca-r84-multiprocess-ledger.test.mjs` ou a suíte `node --test tests/faisca-*.test.mjs` no Linux do CI. Não utiliza chaves, dados reais, servidor externo, interface pública ou custos.

## Interpretação e dependências
A prova não cobre NFS, filesystem remoto, múltiplos hosts/contêineres isolados, billing oficial, preços atuais da OpenAI ou operador malicioso com acesso ao diretório. Continua necessária revisão independente de POSIX, crash, backup, conciliação de Usage e homologação de staging privado. `publicFaiscaEnabled=false` e todas as restrições de merge/deploy/DNS/VPS/Portal/CRM permanecem.