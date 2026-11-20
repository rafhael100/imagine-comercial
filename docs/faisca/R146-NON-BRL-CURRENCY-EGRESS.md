# Faísca R146 — preços internacionais inventados no laboratório privado

## Lacuna
O filtro R115 verificava preços em reais por extenso, ofertas gratuitas fictícias e certos valores com R$. Uma saída real ou sintética Luna/Terra podia escrever **US$ 99**, **€ 79**, **£ 45**, **USD 199**, **350 reais** ou **o valor é 400** sem passar por esses padrões. Um fonte editorial verdadeira não demonstra que o valor inventado foi homologado.

## Correção
- `hasPrivateUnreviewedPriceClaim()`, usado pelo cliente Luna/Terra e pelo servidor HTTP privado, passa a barrar símbolos monetários Unicode (`Sc`), valores numéricos com moeda, denominação escrita e afirmações numéricas de preço/implantação/desconto.
- O navegador mantém um **último filtro independente** para esses formatos mesmo diante de HTTP 200 de um adaptador injetado, sem confiar exclusivamente no backend.
- `node --test tests/faisca-r146-private-non-brl-prices.test.mjs` exercita o filtro, as chamadas Luna/Terra inteiramente fictícias (sem retry nem reembolso), o HTTP loopback autenticado e o JavaScript real de egress do navegador. Resposta geral sem preço permanece permitida.

## Limites e gates
É uma proteção lexical conservadora; pode haver falsos positivos no laboratório e não constitui extração completa de preços, verificação semântica, revisão contratual ou aprovação da equipe. Toda resposta real com preço requer fonte comercial e aprovação do Portal. Nenhuma alteração nos arquivos do site público, mascote, `main` ou `publicFaiscaEnabled=false`.

Validar CI da HEAD exata, revisar editorial/AppSec e homologar a candidata acumulada em staging **privado**. O operador já concluiu R92 na VPS e testou Luna/Terra manualmente; R95+ não se presumem instalados. Sem acesso operacional a chave, deploy, DNS/VPS, CRM/Portal ativo, pessoas reais, compras, tickets ou cobranças. **DRAFT — NO-GO público.**
