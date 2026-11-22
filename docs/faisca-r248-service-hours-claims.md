# Faísca R248 — fronteira editorial para disponibilidade do atendimento

## Motivo
A R247 já barrava perguntas como "O suporte está disponível nos feriados?", mas perguntas invertidas ("Qual é o horário do atendimento?", "Tem plantão nos feriados?") ainda podiam entrar na classificação genérica. Também era possível que uma resposta simulada em terceira pessoa declarasse "O suporte está disponível aos domingos" sem nenhuma fonte editorial operacional aprovada.

## Incremento
- Perguntas sobre disponibilidade e horários do **próprio atendimento** recebem apenas a confirmação editorial do host, inclusive em ordem interrogativa invertida; não são enviadas a Luna/Terra.
- Respostas geradas de aparência institucional, em primeira pessoa, terceira pessoa ou oferta direta ("Temos suporte"), são recusadas no egress do modelo e no HTTP independente.
- Orientações neutras sobre landing pages, atendimento como conceito de marketing e planejamento de suporte continuam aceitas; regra é conservadora e limitada ao laboratório.
- Regressão executável: `node --test tests/faisca-r248-service-hours-claims.test.mjs`. Cobre zero chamadas pagas no adaptador real com transporte falso, rota editorial, sanitização HTTP 503 e resposta geral positiva.

## Gates pendentes
Este controle lexical não demonstra que uma afirmação é verdadeira nem substitui revisão humana, fontes assinadas, auditoria LGPD/AppSec, reconciliação FinOps ou teste autenticado do staging instalado. Não há horários operacionais confiáveis neste laboratório.

Base imutável: R247 #726, `0755af9d063040008b748c10ce99bbe047712d6e`. PR draft isolada; nenhum merge/deploy, modificação de `main`, DNS, VPS, CRM/Portal/Sites, site público ou mascote. `publicFaiscaEnabled=false`. Os testes pagos Luna/Terra e a homologação R92 relatados não foram repetidos. Nenhuma chave ou dado de cliente usado. **NO-GO público**.
