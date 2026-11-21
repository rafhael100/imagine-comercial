# R184 — rejeição de letras homógrafas no laboratório privado

A pergunta fictícia é redigida pelo operador em português. A fronteira autoritativa `readPrivateSyntheticQuestion` agora recusa qualquer letra Unicode que não pertença a `Script=Latin`, antes de iniciar uma chamada Luna/Terra. O objetivo é impedir instruções e identificadores camuflados por letras cirílicas/gregas visualmente parecidas (ex.: “i” latino versus “і” cirílico), não executar transliteração ou reescrever o conteúdo.

Os testes sintéticos executam a função diretamente e o servidor HTTP loopback autenticado: cinco perguntas com caracteres homógrafos recebem 400 sem eco e **zero despacho ao adaptador**. Três perguntas legítimas em português, com acentos, seguem disponíveis; um caso bem-sucedido responde somente com confirmação fixa, sem ação operacional.

## Execução e limites

- `node --test tests/faisca-r184-mixed-script-preflight.test.mjs`
- CI `faisca-guided-lab.yml` deve incluir `tests/faisca-*.test.mjs` e executar Chromium/axe, build e gates correlatos na HEAD exata.
- Este bloqueio é propositalmente conservador para **perguntas fictícias privadas**; pode rejeitar uma pergunta legítima em escrita não latina e **não** equivale a detecção completa de prompt injection ou conformidade LGPD. A interface do navegador será tratada como segundo limite independente.
- Testes pagos e homologação R92 previamente relatados não são repetidos. R95 não está comprovadamente instalada em VPS. Somente fixtures, sem acesso a chaves, dados reais, CRM/Portal/Sites operacional, DNS, deploy ou merge. `main`, site público, mascote e `publicFaiscaEnabled=false` permanecem preservados. **NO-GO público**.
