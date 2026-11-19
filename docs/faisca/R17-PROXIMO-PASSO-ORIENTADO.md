# Faísca R17 — próximo passo comercial orientado e copiável

**Base:** R16, PR #479, SHA `603a95cbc0498c5b15ef1a4e459e72fecea01f99`.  
**Escopo:** demonstração isolada R08, sem Portal/CRM, dados reais, IA externa ou emissão de propostas.

## Problema

Após concluir as cinco perguntas de qualificação, a R08 apresentava um resumo copiável, porém não orientava claramente o visitante sobre o que poderia fazer em seguida. Isso reduzia a utilidade comercial do Faísca e podia induzir a tentativa de concluir contratação dentro de uma conversa que não tem esse poder.

## Entrega

- `ops/faisca/qualification/next-step.mjs`: constrói o contrato fechado `faisca.qualification-next-step.v1` somente a partir de um perfil R08 confiável, com `delivery=copy_only`, `sent=false`, `contactCollected=false`, `orderCreated=false`, `paymentCreated=false`, `ticketCreated=false` e `operationalEffects=false`.
- R08 ganhou o botão **Como avançar?**, visível ao concluir a qualificação. A resposta explica como revisar e copiar o resumo, valida os limites da proposta oficial e orienta o uso de canais confirmados. **Nenhuma URL, preço, prazo de entrega ou contratação é presumido.**
- A ação está prevista no conjunto fechado do protocolo HTTP `r08:next_steps` e autorizada como resposta local no `http-policy`, sem invocar o PHP nem qualquer provedor.
- O menu final respeita o teto de **seis ações** do contrato HTTP: cinco correções e **Como avançar?**. A opção de trocar de serviço permanece acessível a partir da orientação de próximo passo. Uma tentativa de acessar o próximo passo sem qualificação concluída apenas reapresenta a pergunta faltante.
- A troca de solução ainda exige confirmação. O resumo conserva `contactConsent` como preferência declarada, sem inferir autorização legal ou criar um canal de contato.

## Validação

`tests/faisca-r17-next-step.test.mjs` abrange perfil confiável vs. forjado, guia incompleto e completo, Onepage/Landing, preferência de contato negada/adiada/positiva, reinício, mudança pendente, teto de seis botões e saída HTTP local validada.

`ops/faisca/qualification/http-browser-qa.mjs` verifica em Chromium a ação comercial, a preservação de zero chamadas PHP para esse passo e sua combinação com a segurança R15 durante a troca de serviço.

```bash
node --test tests/faisca-r17-next-step.test.mjs tests/faisca-r08-qualification.test.mjs tests/faisca-r08-journey.test.mjs tests/faisca-r08-http.test.mjs
npm test
```

Para executar o navegador HTTP R08 com PHP, seguir o workflow `Faísca R06 - grounded commercial passages with real PHP`, que fixa o commit do Imagine AI Agents. **Somente declarar a entrega validada quando a SHA exata apresentar CI verde.**

## Próximos gates

1. Revisão independente da cadeia R07–R17 (e conferência de todas as SHAs empilhadas).
2. Validar conteúdo editorial PT-BR e equivalentes EN/ES antes de qualquer publicação.
3. Integração futura com entrada oficial do Portal mediante identidade, MFA/grants, consentimento aplicável, revogação, recibos, segurança e revisão operacional.
4. Qualquer coleta/envio real de lead depende de avisos, finalidade, canal, retenção, testes e aprovação de ativação próprios.

**Não houve alteração em `src/` ou `public/` do site, no PNG/CSS do mascote, na VPS, DNS, Cloudflare ou `main`. Nenhum pagamento, custo, credencial, integração real ou deploy.**
