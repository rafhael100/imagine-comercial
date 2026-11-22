# Faísca R247 — impedir horários e disponibilidade institucional inventados

## Motivação
Mesmo após os gates R244–R246, perguntas fictícias como “O atendimento funciona aos sábados?” ou “O suporte está disponível nos feriados?”, sem dizer “Imagine” ou “equipe”, poderiam seguir para a classificação geral. Da mesma forma, a redação livre “Atendemos aos domingos” poderia aparentar ter respaldo editorial sem qualquer fonte operacional aprovada.

## Correção
- Perguntas sobre horário/disponibilidade de atendimento/suporte/plantão/assistência são encaminhadas à confirmação fixa da equipe sem consulta Luna/Terra.
- Saídas geradas que aleguem em primeira pessoa “atendemos”, “respondemos”, “estamos disponíveis”, “funcionamos” ou disponibilidade do atendimento são rejeitadas pelo gate de egress, inclusive em adaptadores injetados.
- Preserve orientação genérica de autoatendimento e educação em marketing.
- Teste executável em Node: node --test tests/faisca-r247-unverified-support-hours.test.mjs. Cobre rota, zero requisições sintéticas, rejeição HTTP 503 e resultado geral permitido.

## Limitações e condições
A regra lexical é deliberadamente conservadora e não substitui revisão editorial, grounding, LGPD ou verificação humana de horários reais. Não há interface com calendários/CRM/Portal/Sites, não configura atendimento nem cria tickets.

PR draft empilhada sobre R246 #725, sem alteração de main, mascote, site público ou publicFaiscaEnabled=false. R92 e o teste pago Luna/Terra já relatados não serão repetidos. Somente fixtures, sem chave, chamadas pagas, dados pessoais, VPS/DNS, deploy ou merge. É obrigatório validar a CI completa na HEAD final e os gates operacionais antes de qualquer atendimento real. **NO-GO público**.
