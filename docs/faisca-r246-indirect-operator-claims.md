# Faísca R246 — perguntas indiretas sobre equipe/agência/assistente (DRAFT)

## Lacuna confirmada
R244/R245 isolavam perguntas citando diretamente Imagine, Faísca ou “vocês”. Perguntas fictícias sobre “a equipe”, “essa agência”, “o assistente” ou “o chatbot”, sem nome da marca e sem substantivo de processo, ainda podiam seguir para a classificação Luna e receber texto potencialmente institucional de Terra. A ausência do nome da marca não constitui autorização para o modelo anunciar disponibilidade, atendimento ou capacidades operacionais.

## Implementação
- privateConversationRoute reconhece referências indiretas com qualificadores específicos e encaminha essas perguntas à resposta fixa de confirmação editorial, sem solicitar modelos nem criar gastos.
- safePrivateGeneralReply aplica a mesma regra à resposta produzida por um adaptador/modelo, negando afirmações institucionais indiretas mesmo quando a pergunta era geral.
- Preserva receitas exatas de preço/processo e orientação geral sem referência ao operador; não concede escopo de operação, Portal, Sites, CRM, cobrança ou produção.
- Teste: node --test tests/faisca-r246-indirect-operator-claims.test.mjs, com perguntas fictícias acentuadas/não acentuadas, zero transportes simulados, rejeição do modelo no HTTP 503 sanitizado e controle positivo de resposta geral.

## Gates
Executar CI na HEAD desta PR (Node/HTTP, Chromium/axe/WCAG, SEO/build, compatibilidade Portal, PostgreSQL descartável, PHP) e revisar qualquer regressão. Usar apenas fixtures sintéticas, sem dados reais ou novas chamadas pagas. A R92 e o teste manual pago Luna/Terra foram relatados como concluídos; não replicá-los por hábito.

Ainda não há evidência direta de instalação acumulada R95–R246 na VPS, nem revisão independente AppSec/LGPD/FinOps/editorial e reconciliação de gastos. PR draft empilhada sobre R245, sem merge/deploy/DNS nem alterações de main, site público ou mascote; manter publicFaiscaEnabled=false. **NO-GO público.**
