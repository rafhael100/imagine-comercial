# Codex — revisão independente do Faísca R10 (somente leitura)

**Repositório:** rafhael100/imagine-comercial  
**PR:** https://github.com/rafhael100/imagine-comercial/pull/473  
**Base empilhada:** Faísca R09 — https://github.com/rafhael100/imagine-comercial/pull/472  
**Escopo:** R10-A/B/C, triagem anônima e interface de laboratório.

## Instrução

Faça revisão técnica independente, em **somente leitura**. Não implemente alterações nesta tarefa; não faça merge, deploy, DNS, VPS, Cloudflare, contratação, criação de chaves ou uso de dados reais.

Revise o diff entre R09 e R10 e confronte com `docs/faisca/R10-TRIAGEM-ANONIMA-POSVENDA.md`.

## Gate de segurança

1. Verifique que `triage.mjs` usa valores enumerados, estado opaco e imutável, sem armazenar texto livre ou dados de contato.
2. Confirme que a ordem assunto → serviço declarado → detalhe é obrigatória e que correção limpa dependências.
3. Confirme que assunto, serviço e detalhe **não** comprovam identidade, contratação, autenticação ou autorização operacional.
4. Revise o texto para impedir promessas de consulta de pedido, pagamento confirmado, abertura de ticket, alteração de contrato, cancelamento, prazo e atendimento humano conectado.
5. Inspecione `journey.mjs`: getters hostis, sessão clonada, input inválido, texto com senhas/e-mails/telefones (não armazenar ou ecoar), reset e resumo parcial.
6. Prove que `support-ui.mjs` reaproveita o mascote e a interface originais e que `/support/` é página isolada com `noindex`, sem ativação pública.
7. Revise o teste de Chromium `ops/faisca/support/browser-qa.mjs`: sem tráfego externo, cookies, storage, acesso a PHP, CRM ou Portal; teste de privacidade com dados sintéticos e axe em 320/390/1440.
8. Valide o novo limite estático, com medição real de 31 arquivos/17.940.216 bytes, limite de 64 arquivos, 8 MiB por arquivo, 24 MiB no total, allowlist e proibição de symlinks.
9. Confirme que o diff não toca nos diretórios raiz `src/` e `public/`, PNG do mascote ou scripts de deploy.
10. Verifique as evidências de CI **da SHA revisada**, não de commit anterior; diferencie teste de laboratório de operação real.

## Formato do parecer

- **BLOCKER / HIGH / MEDIUM / LOW**, com arquivo, linha, impacto e reprodução;
- falsos positivos separados de achados confirmados;
- controles e testes aprovados;
- observações sobre ausência de identidade, ticket, Portal e armazenamento;
- conclusão: `READY FOR HUMAN REVIEW` ou `CHANGES REQUIRED`.

A PR deve continuar draft até as revisões R07, R08, R09 e R10 e a autorização humana para qualquer integração. Nenhuma execução desta revisão pode modificar arquivos ou PRs.
