# Faísca R08 — qualificação comercial e resumo de atendimento

**Branch:** feat/faisca-r08-lead-qualification-2026-11-18  
**PR:** #469, empilhada sobre a R07 (#465)  
**Escopo:** laboratório local; nenhuma integração operacional.

## Objetivo

Depois de o visitante confirmar uma solução R07, o Faísca conduz uma qualificação progressiva. O visitante responde a uma pergunta por vez, pode indicar que ainda não sabe e pode corrigir respostas anteriores. Ao final, recebe um resumo que pode copiar. O resumo nunca é enviado automaticamente.

## R08-A — perfil estruturado

O schema `faisca.lead-profile.v1` aceita apenas:
- serviço confirmado: Onepage ou Landing Page;
- objetivo;
- público;
- disponibilidade de textos e imagens;
- previsão de início;
- preferência explícita sobre contato futuro.

O perfil é criado somente a partir de uma sessão R07 confiável, com uma escolha de serviço confirmada e sem outra confirmação pendente. O estado é opaco, imutável e mantido em memória. Clones e perfis forjados são recusados.

As respostas são enumerações fechadas. Não existe campo para nome, telefone, e-mail, credenciais ou texto livre. Campos não informados permanecem explícitos. O consentimento começa em `not_asked` e não é inferido.

## R08-B — jornada guiada

A rota de laboratório `/journey/` integra a qualificação à conversa R07:
1. propor a solução;
2. confirmar a solução;
3. perguntar o objetivo;
4. perguntar o público;
5. perguntar sobre materiais;
6. perguntar a previsão;
7. perguntar a preferência de contato futuro;
8. mostrar resumo copiável.

Perguntas comerciais que não pertencem ao questionário continuam sendo tratadas pela base editorial R07. Uma proposta de troca de solução suspende a qualificação anterior até nova confirmação. Serviços sem questionário R08 aprovado permanecem no atendimento guiado R07; o Faísca não inventa um roteiro de qualificação.

Correções reiniciam o campo escolhido e todos os campos posteriores. Isso também reinicia a preferência de contato futuro quando a correção altera qualquer resposta anterior à autorização.

## Resumo e limites do encaminhamento

O schema `faisca.lead-handoff.v1` usa `delivery=copy_only`, `sent=false` e `operationalEffects=false`. O resumo esclarece que nenhum dado de contato foi coletado e que nada foi enviado à equipe ou ao CRM.

A resposta “Sim, autorizo” registra somente a preferência declarada pelo visitante para um possível contato futuro. Não coleta canal ou endereço de contato, não constitui autorização legal genérica e não dispara contato. Uma futura etapa de coleta de contato exigirá aviso de privacidade, finalidade, canal, retenção e controles próprios.

## Testes

- `tests/faisca-r08-qualification.test.mjs`: schema, serviço confirmado, imutabilidade, sequência, consentimento, correções e perfis forjados.
- `tests/faisca-r08-journey.test.mjs`: integração R07/R08, dúvidas durante qualificação, troca de serviço, resumo parcial, correções e isolamento.
- `ops/faisca/journey/browser-qa.mjs`: fluxo no Chromium, correção, responsividade e axe/WCAG.

Comando local após o build do laboratório:

```bash
node --test tests/faisca-r08-*.test.mjs
node ops/faisca/journey/browser-qa.mjs
```

## Próximas etapas

- **R08-C:** melhorar o resumo comercial, a experiência de copiar e as opções de revisão.
- **R08-D:** executar o mesmo fluxo em HTTP com estado R08 por sessão, conciliação, reset e PHP real somente para respostas editoriais R07.
- **R08-E:** especificar o futuro contrato de encaminhamento para o CRM, ainda sem escrita ou envio.

## Segurança e publicação

Sem LLM externo, coleta de contato, CRM, e-mail, pagamentos, scoring, persistência, deploy, DNS, VPS ou custos. Mascote, CSS e identidade visual aprovados permanecem sem alterações. `publicFaiscaEnabled=false`.
