# Faísca R10 — triagem anônima de pós-venda

**Escopo:** laboratório isolado de orientação, sem autenticação, consulta de cliente, abertura de ticket ou envio à equipe.  
**Base:** R09, PR #472, ainda em revisão.  
**PR desta etapa:** #473 (draft, empilhada).

## Objetivo

Permitir que o Faísca organize o assunto de um potencial atendimento pós-venda, mesmo quando a pessoa ainda não está autenticada. A ferramenta não confirma se ela é cliente, não consulta o status de um projeto e não altera contratos ou pagamentos. Isso prepara o terreno para um atendimento autenticado futuro, sem criar falsas expectativas hoje.

## R10-A — modelo fechado de triagem

Arquivos: `ops/faisca/support/triage.mjs`, `tests/faisca-r10-support.test.mjs`.

A pessoa escolhe, nesta ordem:
1. Assunto: acompanhamento de entrega, dificuldade técnica, cobrança/contrato, alteração/cancelamento ou orientação geral.
2. Serviço informado: Site Onepage, Landing Page, Google Ads, Meta Ads, Imagine CRM ou “prefiro não informar”.
3. Detalhe: alternativas aprovadas específicas do assunto, incluindo “ainda não sei”.

As opções são enumeradas. O sistema não registra nomes, telefones, e-mails, documentos, IDs de pedido, URLs, senhas, credenciais ou texto livre. O objeto de sessão é opaco, congelado e reconhecido apenas quando criado pelo próprio módulo; objetos forjados ou clonados são recusados.

Uma correção apaga o campo escolhido e seus dependentes. Sessões diferentes não compartilham o perfil.

## R10-B — jornada anônima

Arquivos: `ops/faisca/support/journey.mjs`, `tests/faisca-r10-journey.test.mjs`.

A jornada responde por opções fechadas; qualquer texto digitado é ignorado e não é ecoado no histórico. A interface usa a marcação `[Mensagem livre não registrada]` para impedir que senhas e dados pessoais digitados apareçam na conversa.

O resumo é apenas copiável, com `faisca.support-brief.v1`, `mode=copy_only`, `sent=false`, `ticketCreated=false`, `verifiedCustomer=false`, `requiresAuthentication=true` e `operationalEffects=false`.

O texto informa explicitamente que a pessoa precisa utilizar o Portal autenticado ou um canal oficial confirmado para consultar ou alterar serviços reais. Não inventa URL, SLA, prazo, boleto, confirmação de pagamento, ticket ou cancelamento.

## R10-C — página local navegável

Rota **somente de laboratório**: `/support/`, no Astro isolado `ops/faisca/lab/astro.config.mjs`. Não é uma rota pública do Imagine Comercial.

- `ops/faisca/lab/src/components/FaiscaSupportLab.astro`: ativação explícita e avisos de privacidade.
- `ops/faisca/support/support-ui.mjs`: reaproveita o componente e o mascote aprovados, sem mudar o arquivo de imagem ou o CSS.
- `ops/faisca/support/browser-qa.mjs`: Chromium, correção, reset, ausência de eco de dados sensíveis, acessibilidade e responsividade.

A página começa estática; o controlador é carregado apenas após ativação. O navegador não envia requisições externas, não grava cookies, localStorage ou sessionStorage, e o suporte não chama PHP ou qualquer modelo externo.

## Regras de segurança

- O visitante **não é considerado cliente autenticado**.
- A escolha de um serviço **não comprova contratação**.
- Nenhum valor ou status comercial é confirmado.
- Nenhum ticket é aberto. O resumo não é enviado à equipe, CRM, Portal, e-mail ou mensageria.
- O Faísca não recebe documentos, credenciais, dados de contato ou transcrições livres.
- Ações de cobrança, alteração e cancelamento exigem autenticação, contrato e canais oficiais, em etapa posterior.
- Dados do laboratório são sintéticos e voláteis.

## Reproduzir as provas

```bash
node --test tests/faisca-r10-*.test.mjs
# Com npm ci, Chromium e IMAGINE_FAISCA_LAB=1:
npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/support/browser-qa.mjs
```

O workflow `Faísca - demonstração guiada e acessibilidade` executa o teste de navegador e conserva evidência sintética `Faisca_R10_SUPPORT_BROWSER_QA.json`.

Aumentou-se a capacidade máxima da lista estática do servidor loopback de 128 para 160 arquivos por causa dos bundles extras, preservando limites de **8 MiB por arquivo** e **16 MiB no total**, proibição de symlinks, diretórios fora da allowlist e requisições fora de loopback. O teste `tests/faisca-http-server.test.mjs` verifica o limite de 160 e a recusa do arquivo 161.

## R10-D — preparação para pós-venda autenticado (posterior)

Uma futura integração deverá depender de identidade da empresa, MFA/grants, autorização de serviço, escopo de dados mínimo, audit trail, revogação, idempotência e processo real de abertura de ticket. O Faísca não deve prometer um resultado de suporte até receber confirmação do sistema responsável.

Nenhuma dessas integrações foi habilitada ou está implícita nesta PR. **Sem merge, deploy, DNS, VPS, custos ou publicação.**
