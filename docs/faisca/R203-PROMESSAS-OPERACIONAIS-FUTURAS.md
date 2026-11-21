# Faísca R203 — promessas de operação futura rejeitadas em ambiente privado

## Incremento de confiabilidade

O Faísca de laboratório não tem permissão para publicar sites, ativar anúncios, cadastrar leads, abrir chamados ou criar pedidos. A defesa existente rejeitava declarações de operações **já concluídas**, mas não necessariamente promessas futuras como “vou publicar seu site” e “sua campanha será ativada”.

A R203 acrescenta duas verificações conservadoras à política autoritativa, já utilizada pelo adaptador Luna/Terra e pelo HTTP: compromissos em primeira pessoa e promessas passivas sobre ativos do visitante. Respostas rejeitadas produzem 503 genérico, sem devolver o texto do modelo. Orientações condicionais como “você pode publicar quando estiver pronto” continuam aceitas.

O teste `node --test tests/faisca-r203-future-operations-private-egress.test.mjs` usa corpus inteiramente fictício, valida a saída HTTP real em loopback e preserva a recusa de CORS, de vazamento e de efeitos operacionais. `npm test` inclui este teste automaticamente.

## Limitações e gates

Regex não certifica semântica, intenções nem veracidade; revisão editorial humana segue obrigatória. Não há acesso a chave real ou faturamento, instalação VPS comprovada da R95 em diante, homologação acumulada de staging nem autorização pública. Teste pago Luna/Terra e homologação R92 anteriormente informados não foram repetidos.

Branch isolada / PR draft; `main`, mascote, site público e `publicFaiscaEnabled=false` intactos. Sem deploy, VPS/DNS, dados reais, CRM/Portal/Sites operacional, leads, tickets ou cobrança. Revisões AppSec/LGPD/FinOps/editorial e reconciliação independente de consumo continuam gates.
