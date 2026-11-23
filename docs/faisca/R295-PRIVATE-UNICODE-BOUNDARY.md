# R295 — Unicode no laboratório privado

A barreira compartilhada recusa caracteres default-ignorable, substitutos UTF-16 isolados, noncharacters Unicode e separadores de linha/parágrafo antes de normalizar ou serializar. A defesa anterior de entrada já recusava default-ignorable; a saída precisa verificar independentemente. Não remover ou reparar texto para encaminhar ao modelo. Acentos portugueses e caracteres suplementares válidos continuam possíveis.

Testes Node verificam a barreira, preflight sem invocação, e HTTP com adaptador fictício que produz saída inválida. O HTTP deve devolver erro genérico sem eco, cookies ou CORS. Executar `node --test tests/faisca-r295-private-unicode-boundary.test.mjs` e CI completa. Não é DLP completo ou garantia editorial/LGPD.

Sem credenciais reais, gastos, deploy, merge, operação CRM/Portal/Sites ou GO público. R95 em staging não comprovada. Preservar site, mascote, main e publicFaiscaEnabled=false.
