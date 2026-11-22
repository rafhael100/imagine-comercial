# Faísca R211 — recibos editoriais fixos verificados no navegador privado

**Base revisada:** R210 #688, SHA `b13078efe1408156c942cf9968e7a97bb13ab66d`. R95 #570 continua draft, com 6/6 workflows aprovados na HEAD `91951653fca999f26595cc8113fbaff151225a89`. Laboratório exclusivo, sem autorização de produção.

## Lacuna

A resposta HTTP de um cenário fixo podia ser forjada com `sourceRecipeBound: true`, modelos sintaticamente válidos e um ID editorial real, porém de **outra receita/cenário**. O navegador conferia IDs da lista global, mas não a correspondência exata à pergunta fixa. O limite autoritativo do servidor verifica a receita da resposta real; isto reforça de maneira independente a apresentação contra respostas HTTP adulteradas.

## Correção

- Para cada `caseId` fixo, a interface embute os conjuntos de IDs de fontes **em ordem** que o roteador determinístico aprovado pode selecionar para a pergunta fictícia correspondente.
- O navegador recusa HTTP 200 com fonte globalmente válida, mas fora dos conjuntos autorizados para o cenário, mesmo com `sourceRecipeBound: true`, ambos os modelos e JSON correto.
- Não altera resposta gerada, não declara validade factual do texto, não troca limites existentes de custo, não habilita atendimento público.
- QA Chromium injeta um HTTP 200 sintético com fonte real mas alheia à pergunta, e verifica rejeição, ausência de citação, limpeza do token e nenhuma segunda chamada ao transporte. O teste positivo da R79 continua cobrindo uma receita válida realista.

## Gates

- [ ] CI da HEAD exata: Node/HTTP, Chromium/axe, PHP, PostgreSQL descartável, Onepage/Portal, Comercial/SEO/build; não marcar previamente como concluída.
- [ ] Revisão independente AppSec, editorial, privacidade e FinOps, inclusive limite do JS privado de 24 KiB.
- [ ] Homologação acumulada R95–R211 em staging privado com evidência operacional, sem inferir instalação na VPS.
- [ ] Conciliação externa do consumo e confirmação humana antes de qualquer GO.

Nenhum dado de cliente, credencial real, chamada paga, alteração de VPS, merge, deploy ou operação de Portal/Sites/CRM é parte desta entrega. `publicFaiscaEnabled=false` permanece obrigatório.
