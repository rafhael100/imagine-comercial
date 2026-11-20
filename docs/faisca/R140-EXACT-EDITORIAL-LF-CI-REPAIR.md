# Faísca R140 — preservar quebras LF apenas em recibo editorial exato

## Falha encontrada na CI da R139 #615
Na HEAD `92568517ec088e0a12cc54cd90789ae25861f4aa`, os workflows Comercial/SEO e Faísca/Chromium falharam antes do browser no teste positivo `R138: approved editorial ID remains displayable in free editorial synthetic fixture`. O navegador rejeitava todas as respostas com `\n` por uma regra global para caracteres de controle. Porém as receitas R06 aprovadas para `pricing` e `process` contém quebras LF literais entre título, passagem e encerramento.

## Correção e evidência exigida
- Aceitar LF somente em resposta *editorial_answer* da pergunta livre cuja resposta e todas as fontes ordenadas correspondam **exatamente** à receita R06 pinada no código. Nenhuma exceção para resposta de modelos, cenário fixo, `\r`, tabs, HTML ou mensagens adulteradas.
- Teste positivo R138 mantém o texto original com LF. Novos testes negativos verificam troca por CRLF e LF extra. A matriz Chromium R139 valida ID inventado, prosa com ID válido, e recibo exato.
- Executar `node --test tests/faisca-r138-browser-editorial-source-allowlist.test.mjs`, `npm test`, `npm run test:browser` via CI, bem como workflows HTTP, axe/WCAG, build/SEO, Onepage/Portal, PHP e PostgreSQL descartável. Documentar resultados da HEAD exata, não presumir verde até observação da Actions.

## Limitações
O browser só faz defesa em profundidade; servidor HTTP/receitas continuam autoritativos. Revisão independente AppSec/LGPD/editorial e homologação privada acumulada em staging ainda não concluídas. O teste R92 reportado pelo operador não comprova instalação R95+ na VPS. Sem OpenAI key ou acesso autorizado nesta execução; exclusivamente fixtures sintéticas.

**NO-GO público:** `main`, site, mascote e `publicFaiscaEnabled=false` permanecem intactos; sem merge, deploy, VPS/DNS, dados reais, operação CRM/Portal, lead/ticket/cobrança ou chamadas pagas.
