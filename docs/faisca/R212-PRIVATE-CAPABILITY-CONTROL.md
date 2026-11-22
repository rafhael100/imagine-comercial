# Faísca R212 — capacidade operacional fictícia não é autoridade

**Base:** R211 #689, HEAD `27fa00ab684e8d3f7416d227af72878b32a8690a`. A R95 #570 tem 6/6 workflows aprovados na HEAD `91951653fca999f26595cc8113fbaff151225a89`, mas não se presume instalada.

## Falha de qualidade e segurança

A política R203 barrava promessas como "vou publicar seu site", mas não recusava sempre uma afirmação de *capacidade* do assistente, por exemplo "posso publicar seu site" ou "consigo ativar sua campanha". Isso induz o operador a acreditar que o laboratório dispõe de privilégios no Portal/Sites/CRM, mesmo sem ferramentas ou integração operacional.

## Incremento privado

- A borda de saída autoritativa passa a rejeitar declarações em primeira pessoa de aptidão ou compromisso futuro de criar/publicar/ativar/configurar/cadastrar/integrar/hospedar, enviar ou abrir operação. Conserva orientações de autosserviço sem atribuir poderes ao Faísca.
- O navegador privado implementa **checagem independente** da mesma classe de alegações antes de renderizar um HTTP 200 adulterado; nunca confia apenas na declaração `operationalEffects:false`.
- Testes Node verificam casos positivos/negativos e HTTP real em loopback. O teste Chromium verifica rejeição de respostas forjadas, limpeza de credenciais temporárias e ausência de tentativas adicionais ou chamadas a provedor pago.
- Regras lexicais são defesa em profundidade, **não** certificação semântica de IA ou autorização de uma operação.

## Gates de revisão

- [ ] CI vinculada à HEAD final: Node/HTTP/Chromium/axe/WCAG, PHP, PostgreSQL descartável, Portal/Onepage e build/SEO.
- [ ] Revisão independente AppSec/LGPD/editorial/FinOps e conciliação de consumo.
- [ ] Homologação acumulada somente em staging privado, com evidência externa de ambiente, não inferida por CI.
- [ ] GO público permanece proibido: `publicFaiscaEnabled=false`, sem deploy, merge ou alteração de infraestrutura.

A entrega usa somente frases fictícias. Não acessa chaves nem a VPS; não cria leads, pedidos, tickets ou cobranças.
