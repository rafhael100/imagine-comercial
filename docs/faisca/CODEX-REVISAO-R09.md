# Codex — revisão independente do Faísca R09 (somente leitura)

**Repositório:** rafhael100/imagine-comercial  
**PR:** https://github.com/rafhael100/imagine-comercial/pull/472  
**Branch:** feat/faisca-r09-grounded-router-2026-11-18  
**Dependências:** R08 PR #469 e R07 PR #465  
**Relatórios:** docs/faisca/R09-ROTEAMENTO-CONVERSACIONAL.md e docs/faisca/R09-E-GATE-ATIVACAO-IA.md

## Missão

Faça uma revisão técnica independente, somente leitura, de R09-A/B/C/D/E e das alterações de jornada R08 incluídas nesta branch. Não implemente correções. Não faça merge, deploy, publicação, alteração de branch, acesso à VPS/Cloudflare, escrita no CRM, conexão de LLM, envio de e-mail ou uso de credenciais.

## Áreas obrigatórias

1. **R09 answer router**
   - Verifique se a requisição é construída exclusivamente pelo host.
   - Confirme que o modelo só pode escolher um `answerId` do conjunto fechado, uma clarificação fixa ou `unsupported`.
   - Confirme que o modelo não envia texto final, URLs, ações, ferramentas, preços, prazos ou dados de contato.
   - Verifique versões, correlação, IDs, campos extras, protótipos, getters e clones.

2. **R09 field router**
   - Verifique que os valores permitidos vêm do catálogo fechado R08.
   - Confirme que a resposta só pode ser `matched`, `ambiguous` ou `unknown`, com valor enumerado ou `null`.
   - Verifique negações de consentimento, respostas ambíguas, pontuação e acentuação em português.
   - Confirme que dados sensíveis e instruções indevidas são recusados antes do roteamento.

3. **R09 runtime**
   - Revise idempotência por conversationId/messageId, conflitos, busy, timeout, conciliação, falha e reset.
   - Confirme que resposta tardia não é exibida automaticamente e que nenhum replay gera novo despacho.
   - Confirme que somente provider simulado é aceito e que `externalModelInvocations=0`.

4. **Pipeline R09 → R06/PHP**
   - Confirme que o modelo seleciona somente IDs de respostas editoriais.
   - Verifique que o PHP real do Imagine Agents valida o candidato exato antes de texto e fontes serem exibidos.
   - Confirme que falha/timeout PHP não exibe fontes como comprovadas.
   - Confirme que seleção de serviço e canal de anúncio vira clarificação, sem alterar contratação ou resumo.
   - Revise pin do Agents, execução PHP real e encerramento dos processos.

5. **Integração R08**
   - Confirme que respostas livres são convertidas apenas em valores enumerados.
   - Verifique que “Quero captar leads” durante a pergunta de objetivo não muda automaticamente o serviço.
   - Confirme que ambiguidade não escolhe valor.
   - Confirme que proposta de troca preserva o perfil anterior até confirmação; cancelar restaura a jornada.
   - Verifique que a autorização de contato continua sendo somente preferência declarada, sem canal ou envio.

6. **Browser e HTTP**
   - Verifique que o módulo de field routing é browser-safe e não depende de APIs Node.
   - Revise contratos HTTP, sessão isolada, token cruzado, timeout, conciliação e reset.
   - Confirme que respostas de qualificação não geram PHP desnecessário.
   - Revise acessibilidade, responsividade e ausência de tráfego externo/persistência.

7. **Privacidade, custos e publicação**
   - Confirme ausência de SDK, endpoint, chave ou chamada a LLM externo.
   - Confirme que o gate R09-E exige aprovação humana de provedor, modelo, orçamento, privacidade, região, retenção e segurança.
   - Confirme que não há CRM, Portal, e-mail, mensageria, pagamentos, dados reais, deploy, DNS ou alteração no mascote/site público.

## Testes e evidências

Execute somente em ambiente descartável, com dados sintéticos e commits fixados:
- `node --test tests/faisca-r09-*.test.mjs`
- `node --test tests/faisca-r08-*.test.mjs`
- `node ops/faisca/model-router/demo.mjs`
- `node ops/faisca/model-router/check-grounded-pipeline.mjs` (exige PHP CLI real e Agents pinado)
- Confira os workflows e artefatos referenciados na PR.

## Parecer exigido

- BLOCKER / HIGH / MEDIUM / LOW, com arquivo e linha.
- Evidência reproduzível para cada achado.
- Falsos positivos separados de problemas reais.
- Lista de verificações aprovadas.
- Conclusão: `READY FOR HUMAN REVIEW` ou `CHANGES REQUIRED`.

Registre os limites: roteador ainda simulado, sem provedor real, estado volátil, sem garantia distribuída de exactly-once, sem CRM real, sem contato pessoal e sem persistência.

**Não executar git commit, git push, merge, deploy, alterações de arquivo, branch, workflow ou configuração.**
