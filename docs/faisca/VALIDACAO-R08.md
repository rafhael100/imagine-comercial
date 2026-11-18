# Validação R08 — Projeto FAÍSCA

**Código funcional validado:** `7f7ac3eeba7735f7d70d90f0a133278407def5ef`  
**Branch:** `feat/faisca-r08-lead-qualification-2026-11-18`  
**PR:** [#469 — R08-A/B/D](https://github.com/rafhael100/imagine-comercial/pull/469)  
**Base:** R07 (#465), ainda em revisão independente e sem merge.

## Escopo

- Qualificação progressiva após confirmação de Onepage ou Landing Page.
- Respostas enumeradas; uma pergunta por vez; “não informado” explícito.
- Correção reinicia somente o campo escolhido e os posteriores.
- Preferência de contato futuro não coleta dados de contato nem inicia contato.
- Resumo copy-only, nunca enviado automaticamente.
- Sessão HTTP R08 isolada no servidor, com ações fechadas no contrato.
- Perguntas editoriais R07 são verificadas pelo PHP real do Imagine Agents; o candidato editorial é separado do texto de apresentação R08.
- Timeout exige conciliação da mesma mensagem; reset encerra a sessão e descarta respostas tardias.

## CI específica

| Workflow | Resultado |
|---|---|
| [Faísca guiado 44398316232](https://github.com/rafhael100/imagine-comercial/actions/runs/44398316232) | **SUCCESS** — 199 testes, zero falhas; R08 browser 12/12; WCAG em 320, 390 e 1440 px |
| [Faísca R06/R08 PHP real 44398316208](https://github.com/rafhael100/imagine-comercial/actions/runs/44398316208) | **SUCCESS** — R06 interop 7/7; R06 browser 8/8; R07 HTTP/PHP 6/6; R08 HTTP/PHP 7/7 |
| [Faísca R05 44398316277](https://github.com/rafhael100/imagine-comercial/actions/runs/44398316277) | **SUCCESS** |
| [PostgreSQL descartável 44398316186](https://github.com/rafhael100/imagine-comercial/actions/runs/44398316186) | **SUCCESS** |
| [Comercial/SEO/build 44398316190](https://github.com/rafhael100/imagine-comercial/actions/runs/44398316190) | Em execução na última conferência; não é gate exclusivo do Faísca |

## Evidência do HTTP/PHP R08

Artefato: [14470362861 — faisca-grounding-R06-R08-SYNTHETIC-REVIEW-ONLY](https://github.com/rafhael100/imagine-comercial/actions/runs/44398316208/artifacts/14470362861).

O arquivo `Faisca_R08_HTTP_BROWSER_QA.json` registra:
- `status=passed`, `executedPHP=true`;
- Agents fixado em `36caf2ee3585c3f64a6f1d78552550ae5aaebeb0`;
- conhecimento `faisca-editorial-2`, digest `fe7daf5ab310acc5a0a600803254344ed02eff7bbd860b731cdf033dcbe4ead7`;
- 7/7 cenários R08 aprovados;
- 5 processos PHP iniciados, 4 concluídos, 1 encerrado intencionalmente pelo cenário de reset;
- 0 falhas PHP inesperadas, 0 pendentes, 0 sessões, 0 sockets e 0 requisições em voo ao final;
- 3 sessões HTTP criadas, 18 mensagens e 4 conciliações;
- 0 tráfego externo, 0 persistência no browser e 0 erros de runtime.

Os cenários cobrem ativação, qualificação local, resposta editorial PHP durante a qualificação, correção, duas sessões simultâneas com o mesmo ID de mensagem, recusa de token cruzado, reset, conciliação e acessibilidade.

## Privacidade, limites e publicação

- O perfil não tem campos para nome, telefone, e-mail, credenciais ou texto livre.
- A preferência “Sim, autorizo” é somente uma preferência declarada; não é consentimento legal genérico e não aciona contato.
- Handoff atual permanece `copy_only`, `sent=false`, `operationalEffects=false`.
- CRM, Portal, e-mail, mensageria, pagamentos e LLM externo não foram conectados.
- Mascote e identidade visual aprovados permanecem inalterados; o site público não foi modificado.
- Sem merge, deploy, DNS, VPS, cobrança ou dados reais.

## Próximas decisões

1. Revisão independente e eventual integração da R07 antes de qualquer merge da R08 empilhada.
2. Concluir o gate geral Comercial/SEO/build.
3. Antes de qualquer integração CRM, seguir a especificação [R08-E](R08-E-PLANEJAMENTO-CRM.md), especialmente identidade de tenant, aviso, canal, consentimento, revisão humana, idempotência e auditoria.
