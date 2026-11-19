# Codex — revisão independente do Faísca R08 (somente leitura)

**Repositório:** rafhael100/imagine-comercial  
**PR:** https://github.com/rafhael100/imagine-comercial/pull/469  
**Branch:** feat/faisca-r08-lead-qualification-2026-11-18  
**Head para revisão:** 8061595310f334d9278bd4709d8dbe61ce13dfaf  
**Código funcional validado:** 7f7ac3eeba7735f7d70d90f0a133278407def5ef  
**Base R07:** feat/faisca-r07-conversation-model-contract-2026-11-18 (ver PR #465)  
**Relatório:** docs/faisca/VALIDACAO-R08.md

## Missão

Faça uma revisão técnica independente, somente leitura, da evolução R08-A/B/D sobre R07. Não implemente correções. Não faça merge, deploy, publicação, alteração de branch, acesso à VPS/Cloudflare, escrita no CRM, conexão de LLM, envio de e-mail ou uso de credenciais.

## Áreas obrigatórias

1. **Origem do perfil e confiança**
   - Confirme que `createLeadProfileFromJourney` só aceita sessão R07 criada pelo módulo confiável, com serviço confirmado e sem outra escolha pendente.
   - Verifique os WeakSets de confiança, objetos congelados, clones, getters e protótipos.
   - Confirme que o serviço confirmado não pode ser trocado por uma resposta de qualificação.

2. **Sequência e correções**
   - Revise objetivo → público → materiais → previsão → preferência de contato.
   - Verifique que apenas a próxima pergunta aceita uma resposta.
   - Confirme que correção limpa somente o campo escolhido e os posteriores, incluindo a preferência de contato.
   - Verifique propostas de troca de serviço, cancelamento, reset e serviços sem questionário R08 aprovado.

3. **Privacidade e consentimento**
   - Confirme ausência de campos de nome, telefone, e-mail, credenciais e texto livre no perfil.
   - Confirme que `contactConsent=granted` é apenas preferência declarada, sem canal, coleta ou contato.
   - Verifique que o resumo não afirma envio e que o handoff permanece `copy_only`, `sent=false`, `operationalEffects=false`.
   - Verifique que respostas recusadas/adiadas não podem ser interpretadas como autorização.

4. **Contrato HTTP e sessões**
   - Revise as ações R08 enumeradas em `conversation-contract.mjs`, a pré-validação no cliente e as razões locais.
   - Confirme que cada sessão HTTP recebe seu próprio fechamento de estado R08 do servidor.
   - Procure replay, payload conflitante, mesmo messageId em sessões diferentes, token cruzado, timeout, conciliação e reset.
   - Confirme que o browser não seleciona tenant, política, provedor ou estado do servidor.

5. **Fronteira PHP e fontes**
   - Revise a separação `providerReply`: somente o candidato editorial R07 exato deve chegar ao PHP.
   - Confirme que o texto de apresentação R08 é composto por código confiável e recebe fontes apenas após validação do PHP.
   - Verifique fallback/unknown: fontes não validadas não podem aparecer como comprovadas.
   - Confirme pin imutável do Imagine Agents, execução PHP CLI real, encerramento de processos e ausência de despacho para escolhas locais R08.

6. **Integridade e publicação**
   - Confirme que o mascote aprovado e os diretórios raiz do site comercial não foram alterados.
   - Confirme `publicFaiscaEnabled=false`, páginas novas restritas ao laboratório, noindex e loopback.
   - Confirme ausência de CRM, Portal, e-mail, pagamentos, LLM externo, persistência, deploy ou dados reais.

7. **Reprodução de evidências**
   - Confira os workflows citados em `docs/faisca/VALIDACAO-R08.md` e o artefato R08 HTTP/PHP.
   - Se executar testes, use somente ambiente descartável, dados sintéticos e commits fixados. Não edite arquivos.

## Parecer exigido

- BLOCKER / HIGH / MEDIUM / LOW, com arquivo e linha.
- Evidência reproduzível de cada achado.
- Falsos positivos separados de problemas reais.
- Lista de verificações aprovadas.
- Conclusão: `READY FOR HUMAN REVIEW` ou `CHANGES REQUIRED`.

Registre os limites mesmo se tudo passar: estado volátil, sem persistência, sem contato pessoal, sem CRM real, sem LLM real e sem garantia distribuída de exactly-once.

**Não executar git commit, git push, merge, deploy, alterações de arquivo, branch, workflow ou configuração.**
