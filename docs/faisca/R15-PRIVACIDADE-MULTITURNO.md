# Faísca R15 — privacidade durante confirmação de troca de serviço

**Base:** R14 (#477), dependente da cadeia R07–R14.  
**Ambiente:** laboratório local/sintético, sem cliente, credencial, CRM, Portal ou modelo externo.

## Defeito identificado na revisão

A qualificação R08 impede que uma mudança de Site Onepage para Landing Page seja aplicada até confirmação explícita. Enquanto a sessão estava em `service_change_pending`, porém, o controlador respondia à entrada de texto livre com `userText: input.text` **sem passar pelo filtro do guia R07**. Em uma interface que mostra o texto da entrada, isso poderia repetir um e-mail, telefone ou senha digitado enquanto a troca estava pendente.

Embora não houvesse envio à equipe/CRM, manter texto sensível em uma transcrição exibida violaria a promessa de proteção da prévia.

## Correção

- Em `service_change_pending`, mensagens livres agora são descartadas do retorno e representadas apenas por `[Mensagem livre não registrada]`; ações não aplicadas usam marcador fixo.
- A resposta informa que o visitante precisa confirmar a nova solução ou cancelar. Não modifica a qualificação.
- O único caminho que altera o serviço continua sendo a ação enumerada `confirm_goal`. `cancel_goal` restaura o perfil anterior. `r08:restart` reinicia o fluxo.
- A apresentação e o HTTP de laboratório recebem apenas o marcador; nenhum valor bruto é preservado no resultado do turno pendente.
- A entrada malformada e getters hostis seguem sendo rejeitados sem leitura dos acessores.

## Provas

`tests/faisca-r15-multiturn-privacy.test.mjs` exercita e-mail, senha, telefone, pergunta pública, tentativa de ignorar instruções, troca não confirmada, cancelamento, confirmação, reinício e caminho HTTP de laboratório.

Reprodução:
```bash
node --test tests/faisca-r15-multiturn-privacy.test.mjs tests/faisca-r08-journey.test.mjs tests/faisca-r08-http.test.mjs
npm test
```

Nenhum desses ensaios prova homologação do Canal do Cliente. Antes de ativar qualificação real, validar escopo de transcrição, consentimento e retenção, privacidade e destino autenticado, revisão independente e CI na SHA exata desta PR.

**Sem merge, deploy, alteração do mascote ou das páginas públicas, sem VPS, cobrança, API externa ou dados reais.**
