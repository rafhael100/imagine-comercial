# Faísca R244 — perguntas sobre o operador exigem confirmação editorial (DRAFT)

## Problema
Uma pergunta livre do operador, inteiramente fictícia, sobre o que **Imagine**, **Faísca** ou **vocês** fazem podia escapar da triagem local de preços e processos. Nessas hipóteses, o laboratório pedia classificação a Luna e resposta a Terra. Mesmo sem acesso a sistemas, a saída poderia sugerir ofertas, horários ou capacidades não confirmadas. O filtro posterior da resposta não é uma fonte de verdade.

## Correção
Após a triagem local de preços e processo editorial, qualquer menção à identidade da Imagine, ao Faísca ou a “vocês” no texto normalizado recebe a resposta determinística já aprovada: `Essa informação precisa ser confirmada com a equipe da Imagine.`. Não há chamadas à API, orçamento consumido, ferramentas ou novas receitas. Perguntas gerais sobre marketing sem operador nomeado continuam elegíveis para classificação privada, com os limites R95. Uma pergunta genérica de preço da Imagine ou de processo reconhecido ainda usa somente a receita editorial local com fontes verificadas.

## Testes
`node --test tests/faisca-r244-operator-editorial-boundary.test.mjs` confere a rota de três perguntas fictícias, prova zero invocações de um adaptador `fetchImpl` que falha em qualquer chamada, e conserva os textos e IDs de fontes oficiais existentes para preço/processo. Complementar com suite Node/HTTP, Chromium/axe, Comercial/SEO/build, Portal/Onepage, PostgreSQL descartável e PHP na HEAD exata.

É deliberadamente conservador: reconhecer uma referência ao operador não prova capacidade, SLA, disponibilidade nem política comercial. Não é tratamento de dados reais, filtro completo LGPD nem liberação pública. A homologação R92 relatada e os testes pagos anteriores não foram repetidos; não há evidência direta de R95–R244 instalado na VPS. Não alterar `main`, mascote/site público, `publicFaiscaEnabled=false`, DNS, Docker nem serviços operacionais. **NO-GO público**.
