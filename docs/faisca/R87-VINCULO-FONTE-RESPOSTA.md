# Faísca R87 — vincular fontes ao answerId selecionado (apenas laboratório privado)

Base imutável: R86 #559, SHA `8be436cb0a62bb5989423f60dc522608111c430a`; depende da R85 #558.

## Falha concreta
A R85 verificava se cada fonte existia no catálogo R06, mas aceitava uma fonte **verdadeira e irrelevante** para o recipe e pergunta selecionados. Um resultado real da R72 traz `schema`, `answerId` e `sourceIds`, permitindo verificar a ligação sem pedir interpretação ao modelo.

## Controle novo
Para envelopes com `schema=faisca.openai-private-live-lab.v1` e `status=draft_answer`, o endpoint privado exige:
1. `answerId` como propriedade de dados segura, integrante dos candidatos recuperados para a pergunta fictícia selecionada.
2. `getGroundedAnswer(answerId)` válido na base editorial R06.
3. `sourceIds` com **a mesma quantidade, ordem e valores** das fontes do recipe aprovado.
4. Qualquer descompasso retorna HTTP 503 neutro, sem novo despacho nem vazamento do texto.

A resposta privada indica `sourceRecipeBound=true` somente quando essa verificação passou. Fixtures históricas sem schema permanecem executáveis, mas sinalizam `false` — esse caminho é exclusivamente de laboratório, **não** prova fidelidade factual nem deve ser conectado ao público. O fallback com schema real exige `source=host_fixed_fallback`, sem fontes/modelos.

## Reproduzir
```sh
node --test tests/faisca-r87-real-answer-source-binding.test.mjs
node --test tests/faisca-r85-private-editorial-sources.test.mjs tests/faisca-r83-model-provenance-private-review.test.mjs
```

Revisão independente: confirmar mapeamento das três perguntas, modelo de confiança do `schema`, cobertura de textos inseridos, resposta sem semântica comprovada e riscos dos fixtures antigos. CI sintética não testa corretude semântica, identidade operacional, aceite de contrato ou staging. Não publicar nem ligar CRM/Portal. `publicFaiscaEnabled=false`; sem merge, deploy, DNS/VPS, chaves, dados reais, serviços pagos, leads/tickets ou cobrança.
