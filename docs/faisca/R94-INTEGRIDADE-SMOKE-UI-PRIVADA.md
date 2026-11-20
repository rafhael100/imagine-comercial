# Faísca R94 — integridade do smoke HTTP estático privado

O smoke GET de R86/R92 conferia apenas algumas palavras em HTML/JS/CSS. Um arquivo obsoleto ou adulterado contendo esses fragmentos, mesmo com MIME/CSP/noindex/no-store adequados, podia produzir `PRIVATE_UI_READONLY_VERIFIED`. Isso **não** comprovava sequer que os bytes da tela privada revisada eram os servidos no loopback.

R94 importa os três assets da mesma versão do módulo local `private-review-page.mjs` e exige **comparação exata do conteúdo UTF-8** recebido por GET de cada rota. Mantém as validações anteriores de cabeçalhos, tamanho, timeout, origem loopback e nenhuma chamada ao modelo. Teste `tests/faisca-r94-exact-private-assets-smoke.test.mjs` usa HTTP real, valida os assets corretos e injeta deliberadamente um newline extra no final de cada asset (todos os marcadores continuam presentes). Os três desvios devem bloquear a homologação.

A comparação é uma **prova de coerência local** entre módulo e servidor, não de autenticidade do checkout. Um checkout malicioso que substitua módulo e resposta ainda poderia passar; por isso permanecem obrigatórios SHA completa pinada independentemente, árvore limpa, revisão de AppSec, inspeção do operador e controles duráveis de gastos. Uma futura composição da PR concorrente #567 que altere a tela privada deve reexecutar esse teste e receber revisão específica; não copiar cegamente a UI antiga.

**Base:** R93 #568, que deriva de R92 #566. Nenhuma alteração ao site público, mascote, `main` ou `publicFaiscaEnabled=false`. Sem deploy, VPS, credenciais, dados reais ou LLM pago.
