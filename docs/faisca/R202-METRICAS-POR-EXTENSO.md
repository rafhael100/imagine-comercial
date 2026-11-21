# Faísca R202 — estatísticas por extenso e razões sem fonte

## Problema observado

A R201 fecha percentuais em algarismos, números comerciais e referências genéricas a estudos. Uma resposta livre ainda poderia afirmar “oitenta e três por cento dos visitantes” ou “quatro em cada cinco” como se fossem métricas verificadas. Não há fonte confiável de pesquisas nem acesso a analytics no laboratório.

## Incremento

- A política privada rejeita taxas expressas por extenso, contagens comerciais por extenso (leads, vendas, clientes, conversões, visitas, inscrições, acessos) e proporções do tipo “N em/de cada M”, em algarismos ou palavras.
- O bloqueio utiliza a mesma função de verificação compartilhada pelo adaptador Luna/Terra e pela saída HTTP. Texto rejeitado recebe resposta opaca 503 sem exibir o conteúdo gerado.
- O teste `node --test tests/faisca-r202-written-statistics-private-egress.test.mjs` cobre corpus sintético negativo, orientação neutra preservada e servidor HTTP real apenas em loopback com resposta do provedor simulada. Nenhuma chave é lida.
- `npm test` incorpora o novo teste pela expansão `tests/*.test.mjs`; os demais workflows continuam sendo gates independentes de Node, Chromium/axe, Portal/Onepage, PHP, PostgreSQL descartável e Comercial/SEO.

## Limites e condição de NO-GO

Verificações lexicais não comprovam a veracidade de uma frase nem substituem revisão editorial humana. Quantificações escritas de outras formas podem escapar; frases legítimas podem ser rejeitadas deliberadamente no laboratório. Não há evidência operacional da instalação acumulada da R95 em diante na VPS, nem reconciliação independente do faturamento do provedor. Testes reais Luna/Terra e homologação R92 informados anteriormente foram respeitados e não repetidos.

Mudança somente privada em branch isolada / PR draft. Não alterar `main`, público, mascote ou `publicFaiscaEnabled=false`; sem deploy, DNS, VPS, CRM/Portal/Sites operacional, dados reais, cobranças, leads ou tickets. Revisões AppSec/LGPD/FinOps/editorial e homologação de staging privado continuam necessárias.
