# Faísca R87 · Perguntas livres no laboratório privado

A revisão mantém o token, o túnel SSH, a escuta em `127.0.0.1:4336` e o ledger da R86. Os cenários fixos continuam disponíveis. O campo de texto livre só aparece com a opção explícita abaixo, no servidor privado. Cada envio é independente e exige confirmação de que a pergunta é fictícia.

Depois da CI e da revisão independente, use um checkout privado no commit revisado. Siga o [runbook da R86](R86-OPERACAO-STAGING-PRIVADO-VPS.md) com a SHA da nova revisão. Pare qualquer sessão anterior que use a porta antes do preflight. Reuse o ledger privado existente. No mesmo shell privado, antes de iniciar o servidor, habilite a opção.

```bash
export FAISCA_PRIVATE_SYNTHETIC_CONVERSATION=YES_SYNTHETIC_ONLY
```

Após o preflight e a partida, confira a escuta com `ss -ltn 'sport = :4336'` e rode `node scripts/faisca-private-staging-readonly-smoke.mjs` na VPS. Abra a interface privada pelo túnel e envie os casos abaixo no campo de texto livre.

| Pergunta fictícia | Resultado esperado |
| --- | --- |
| Vale a pena usar uma landing page para divulgar um evento? | Orientação geral como rascunho, com roteamento Luna e redação Terra. |
| Quanto a Imagine cobra por uma landing page? | Informação editorial sobre escopo e proposta oficial, sem valor inventado. |
| Como funciona a criação de um site Onepage na Imagine? | Visão geral com os trechos aprovados do processo e suas fontes. |
| Como aprovo o layout do meu site? | Pedido para confirmar com a equipe, sem instrução operacional inventada. |

A confirmação do operador e os filtros locais são destinados a exemplos fictícios da revisão privada. A conversa pública não é habilitada por esta opção.
