# F142 — Briefing comercial curado sem captação

## Entrega
- A página pública `/contato/` apresenta duas escolhas opcionais: momento do projeto e prioridade, além de serviço e objetivo já existentes.
- Todas as quatro dimensões vêm de listas editoriais restritas. O visitante vê a mensagem preparada; somente ao **clicar** em WhatsApp ou e-mail o dispositivo abre um canal externo.
- O WhatsApp usa apenas texto previamente construído. O e-mail pode receber o mesmo texto no campo `body` quando o briefing adicional é preenchido; não há envio pelo site, nem garantia de entrega.
- Sem formulário `POST`, endpoint de leads, armazenamento local, cookies, telemetria, texto livre, login ou transferência automática para Portal/CRM.
- Sem JavaScript, continuam funcionando os links estáticos de WhatsApp, e-mail e telefone, sem seleção dinâmica.

## Critérios de teste
1. Produto cartesiano de 7 slugs (inclui vazio) × 5 objetivos × 4 momentos × 4 prioridades: 560 combinações testadas com WhatsApp e mailto.
2. Nenhuma mensagem excede 280 caracteres e nenhum assunto excede 120, conforme validadores F36.
3. Identificadores arbitrários/protótipos/strings injetadas são recusados.
4. Página mantém o gate F31 (sem captura), `aria-live`, ajuda explícita e links de contato por clique.
5. `npm test`, `npm run build`, `npm run check:dist` e QA de navegador devem passar no CI.

## Não concluído
- Paridade operacional do formulário legado F70.
- Identidade/consentimento/homologação do receptor Portal/CRM e confirmação de entrega do lead.
- Revisão de conteúdo, canais operacionais, produção, main, DNS, 301, VPS e custos.

**Estado:** candidato exclusivamente de desenvolvimento em PR draft empilhada sobre F141.
