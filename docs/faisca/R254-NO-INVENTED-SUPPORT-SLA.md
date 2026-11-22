# Faísca R254 — impedir SLA e promessas de atendimento inventadas

**Laboratório privado; sem GO público.**

Uma resposta gerada pode inventar um prazo mesmo sem declarar que a Imagine
executou uma ação. A proteção anterior bloqueava horários/plantões declarados
em primeira ou terceira pessoa, mas deixava escapar algumas construções
dirigidas ao visitante: "Você terá suporte", "Os clientes contarão com suporte",
"A equipe responde em até 15 minutos" e "O suporte dá retorno dentro de 2 horas".

A R254 acrescenta duas verificações determinísticas:

1. Perguntas sobre tempo de resposta do atendimento/suporte são encaminhadas
   à confirmação editorial fixa, **sem chamar Luna ou Terra**.
2. Respostas de modelo com promessas de suporte, janela de retorno, SLA,
   disponibilidade 24 horas ou dias específicos não são consideradas
   orientação geral segura; o contrato HTTP privado rejeita a alegação
   (503, sem publicar o texto fabricado).

Os testes cobrem entradas fictícias, resposta local sem chamada de provedor,
resposta maliciosa fabricada por adaptador, ausência de cookies e CORS no HTTP,
e preservam orientações genéricas sobre landing pages e organização de informações.

São tripwires lexicais **conservadores**, não uma aprovação editorial nem um
classificador universal de fatos verdadeiros. Não autorizam prometer horários,
prazos, suporte ou SLA reais. Nenhuma fonte operacional foi conectada, nenhum
dado de cliente foi usado e nenhum crédito pago foi consumido.

**Gates pendentes:** CI completa na HEAD, revisão editorial independente,
proveniência e homologação da instalação real R95+ em staging, controles de
custo e privacidade, decisão humana explícita. Preservar main, site público,
mascote e publicFaiscaEnabled=false; sem merge, deploy, DNS, VPS, CRM ou Portal.
