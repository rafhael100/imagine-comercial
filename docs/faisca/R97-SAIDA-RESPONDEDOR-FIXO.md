# Faísca R97 — integridade de saída para os três cenários fixos da R72

**Base:** R96 PR #571, SHA `608d789cdd9f5042f078d02e13f7df5dd2e49969`, baseada na R95 #570. A R97 é branch draft empilhada e não atualiza o site público.

## Defeito demonstrado

A fronteira de saída `safeReviewOutput` comprovava proveniência Luna/Terra, lista ordenada de fontes e `answerId` da receita local, **mas não garantia que o texto redigido não trouxesse telefone ou identificadores inventados**. Um envelope de resposta associado à receita correta poderia incluir um número de contato espúrio. Esse é um limite distinto de validar apenas as fontes.

A correção aplica o mesmo detector conservador R96 a respostas `draft_answer` dos três cenários R72, em dois lugares: no adaptador privado Luna/Terra antes de devolver o resultado e novamente no host HTTP antes de serializar. Não modifica receitas editoriais fixas, nem dá garantia semântica de que todo o texto gerado esteja fundamentado.

## Provas

`node --test tests/faisca-r97-fixed-case-identifier-egress.test.mjs`:
- POST HTTP loopback real com modelo simulado e `answerId`/fontes legítimos; resultado limpo é 200 e variantes com telefone/CPF fictícios retornam 503 neutro, sem eco.
- Luna/Terra simulados retornando contato inventado no segundo modelo; transport retorna erro editorial sem converter em resposta aprovada.
- Sem chamadas pagas, segredo real, dados de cliente ou acesso a VPS.

## Gates obrigatórios

CI 6/6 **na HEAD exata**, Node/HTTP/Chromium/axe, revisão independente AppSec/FinOps/editorial, staging R95–R97 com preflight/ledger/SHA e operador autorizado. A R92 já foi testada pelo usuário, mas nenhuma evidência direta comprova instalação R95–R97. Não fazer merge/deploy/DNS/VPS ou abrir atendimento público; `publicFaiscaEnabled=false`, mascote, site e `main` preservados.
