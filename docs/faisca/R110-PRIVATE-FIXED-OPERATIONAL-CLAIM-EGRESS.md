# R110 — ações operacionais inventadas em respostas de casos fixos

**DRAFT / laboratório.** Base R109 #584 `e8b4352c70cd84a865bd32f53f9d99b15f5d93f5` e R108 #583. Nenhuma alteração em PR concorrente, main ou site público.

## Lacuna concreta

A R106 adicionou `hasPrivateOperationalClaim()` à validação das respostas **livres**, mas o endpoint fixo `/__faisca_openai_private/respond` ainda validava somente identificadores, contatos, URLs, preços e alguns eventos de cobrança. Um adaptador injetado poderia enviar envelope legítimo (modelo Luna/Terra, `answerId`, fontes R06 coerentes) com a frase fictícia **“Já publiquei seu site”** e receber HTTP 200. Fontes confiáveis não tornam uma ação inexistente verdadeira.

## Correção e regressão

- `safeReviewOutput` passa a aplicar o mesmo detector conservador de ações concluídas utilizado na conversa privada, antes da serialização HTTP.
- `tests/faisca-r110-fixed-operational-claim-egress.test.mjs` usa servidor HTTP loopback real e respostas sintéticas com `schema`, `answerId`, duas identidades de modelo e IDs editoriais corretos. Três alegações de publicação/ativação/conclusão devem responder 503 sem refletir texto ou segredos, **sem chamadas pagas**.
- Controle positivo valida que envelope editorial seguro continua HTTP 200 com `sourceRecipeBound=true`, proveniência e ausência de efeitos operacionais.
- Esse filtro é uma barreira lexical, não prova de qualidade ou verdade semântica: revisão humana editorial e AppSec permanece obrigatória.

## Gates

1. CI 6/6 na HEAD exata R110, incluindo Node/HTTP, Chromium/axe, PHP, Portal Onepage, PostgreSQL descartável e SEO.
2. Revisão independente de risco de alucinações, falso positivo e integração com R109.
3. Homologação privada da versão acumulada por operador autorizado, sem repetir desnecessariamente R92 já relatada como concluída; não presumir R95–R110 instalada na VPS.
4. Para atender clientes reais: identidade/autoridade empresarial, contrato, aceite, recibo, política de privacidade, revisão de conteúdo, staging e GO humano separados.

**Proibições preservadas:** `publicFaiscaEnabled=false`; sem merge, deploy, DNS, alteração VPS, dados reais, credenciais, LLM pago, ações CRM/Portal, leads, tickets ou cobranças.
