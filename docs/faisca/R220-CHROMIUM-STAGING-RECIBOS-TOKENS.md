# R220 — ensaio acumulado de staging privado com recibos Luna/Terra

## O que foi integrado
A R219 valida a consistência dos detalhes do recibo do provedor, mas seus testes executavam apenas HTTP/Node. Este incremento valida também o fluxo **real da interface privada no Chromium**, a comunicação HTTP local, as respostas fictícias de Luna/Terra e a persistência do ledger, mantendo o Faísca aprovado e o site público intocados.

## Prova executável
`node ops/faisca/openai/private-token-details-browser-qa.mjs` no workflow `faisca-guided-lab.yml`, **após** `npm ci` e instalação do Chromium. O teste usa diretórios temporários modo 0700, respostas OpenAI simuladas, bearer fictício, `store:false`, nenhuma ferramenta e endpoint restrito a loopback. Exercita:
- recibos consistentes nos dois modelos, resposta fictícia aceita, um POST, fontes vazias, campos temporários apagados;
- `cached_tokens` de Luna acima de `input_tokens`: HTTP 503 sem resposta insegura, Terra não acionada, reserva durável mantida e marca de resultado incerto;
- reinício com mesmo ledger, sem novo despacho, sem reset de créditos;
- nenhum request externo do navegador, nenhuma persistência em cookies/storage e axe WCAG 2.1 A/AA após o fluxo.

Também continuam obrigatórios os testes do R95/R218/R219, os contratos HTTP, o HTTP 200 sujeito à revisão editorial e a verificação de integridade do PNG do mascote.

## Limites
É um **ensaio automatizado de staging privado em runner descartável**, não observação da VPS, não validação independente da fatura, não prova de entrega ao operador e não é teste pago. Os testes manuais pagos anteriores e a homologação R92 já informada não são repetidos.

**Sem GO público:** branch isolada e PR draft sobre R219; nenhuma alteração de main, DNS/VPS, build público, Portal/Sites/CRM operacionais, cobrança, lead ou ticket. `publicFaiscaEnabled=false`. Revisão AppSec/LGPD/FinOps/editorial, conciliação externa e homologação operacional acumulada seguem bloqueios.
