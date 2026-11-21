# Faísca R197 — recusa de homógrafos em texto da IA

## Risco mitigado

A R184 recusa letras gregas/cirílicas na **pergunta fictícia** antes do modelo. A resposta gerada também é uma entrada não confiável: letras visualmente parecidas poderiam contornar filtros lexicais de preço, contato, promessa, ação operacional ou marca, mesmo com `NFKC` e `NFKD`.

A R197 mantém o contrato privado de português e aplica o mesmo bloqueio de **letras Unicode fora de Script=Latin** na função `hasPrivateIdentifierRisk`, que já é consultada tanto pelo adaptador de respostas Luna/Terra como pela política de saída HTTP. Isso rejeita, por exemplo, `а` cirílico visualmente idêntico a `a` latino. Não translitera, não armazena o texto, não reenvia a pergunta e não realiza retry pago. Uma mensagem legítima em português com acentos latinos continua aceita.

## Prova executável

`node --test tests/faisca-r197-model-output-homograph-egress.test.mjs`

O teste cobre o detector e uma requisição HTTP autenticada em loopback com provedor **injetado**, exigindo 503 genérico sem vazamento da resposta homógrafa, e 200 para uma orientação geral fictícia válida. É executado também por `npm test`; o workflow existente testa Chromium/axe/WCAG/CSP sem alteração do site público.

**Limitações:** o filtro é conservador e pode recusar menções legítimas em outros alfabetos; não resolve todos os homógrafos latinos, inferências ou alucinações. Não substitui grounding de receitas editoriais, verificação de preço, revisão humana e reconciliação do provedor. Não comprova instalação de R95–R197 na VPS, nem executa testes pagos, nem repete R92.

**NO-GO público:** PR draft isolada, `main` e `publicFaiscaEnabled=false` preservados. Nenhum deploy/merge, Portal/CRM/Sites operacional, DNS, lead, ticket ou cobrança. Exigir revisão AppSec/LGPD/FinOps/editorial e homologação privada acumulada antes de qualquer liberação.
