# Faísca R147 — bloquear falsa autoridade e números de performance sem evidência

## Lacuna observada
As R135–R146 bloqueiam várias promessas e preços fictícios, mas textos sintéticos como **“Segundo o Google, todo site Onepage vende mais”**, **“a taxa de conversão é de 45%”** e **“seu site ficará no topo do Google”** não precisam conter a palavra “garantia”, moeda ou uma projeção numérica de leads para parecerem fundamentados. A interface privada tampouco possui pesquisa, fontes de mercado verificadas ou dados de performance do operador.

## Alteração técnica
- A função já usada como barreira comum `hasPrivateUnsupportedOutcomeGuarantee` passa a recusar atribuições inventadas a plataformas/fontes externas, percentuais de desempenho sem receita factual e posições de busca supostamente alcançadas pelo visitante.
- A barreira de saída no próprio navegador repete independentemente os testes para impedir que um adaptador HTTP com resposta 200 contorne o servidor.
- `node --test tests/faisca-r147-private-unsupported-evidence.test.mjs` exercita respostas hostis e neutras com **fixtures totalmente sintéticas** no cliente Luna/Terra (HTTP mock, sem chave real), nos endpoints HTTP privados autenticados em loopback e no JavaScript real da página de revisão executado em VM. Afirmações rejeitadas não devem aparecer no corpo da resposta, não há retry/reembolso implícito, o bearer é apagado e uma orientação genérica segura permanece possível.

## Limites e gates
Controle lexical conservador, com possíveis falsos positivos e sem pretensão de detectar toda alucinação, verificar a veracidade semântica ou substituir revisão editorial humana. Estatísticas, rankings, declarações atribuídas a terceiros e condições comerciais só podem ser exibidas após revisão específica de fontes e autorização do processo adequado. Nenhuma fonte nova foi liberada.

A homologação R92 e os testes pagos Luna/Terra relatados pelo operador permanecem reconhecidos. A instalação de R95+ na VPS **não** foi presumida. Nesta entrega não houve acesso a credenciais, consumo pago, deploy, DNS/VPS, produção, dados reais, Portal/CRM ativo, lead, ticket ou cobrança. `main`, site público, mascote e `publicFaiscaEnabled=false` permanecem inalterados. Próximos gates: CI integral na HEAD exata, AppSec/LGPD/editorial e homologação **privada** acumulada por operador autorizado. **DRAFT — NO-GO público.**
