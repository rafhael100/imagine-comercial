# F66 — Auditor SEO independente RC15 na versão mais recente do Comercial

A integração F0–F65 foi construída após o ensaio RC15 [PR Comercial #85](https://github.com/rafhael100/imagine-comercial/pull/85), cuja branch agora está divergente. Este PR transporta exclusivamente o pin imutável do Imagine SEO Engine RC15, SHA `c9dcc458fdaa94f9c8aa57fe27078c9c9401a7c2`, para uma branch criada da integração atual, sem reverter as páginas `/como-funciona/` e `/perguntas-frequentes/`.

O auditor RC15 acrescentou verificações de pré-voo sobre seleção exata de propriedade Search Console e vínculo com plano de leitura, sempre bloqueando produção sem OAuth/tenant/consentimento reais. Aqui a CI não conecta o Google, não recebe dados reais, não aprova a propriedade, não executa redirects e não muda indexação.

Os testes de CI imutável e pin independente foram atualizados para a mesma SHA. A auditoria permanece em `--fail-on-warnings --strict-public-head` e precisa validar **todas as páginas atuais**, inclusive F64/F65, na branch de revisão. O resultado do PR #85 sobre uma base antiga não é prova da versão atual. O lançamento permanece condicionado ao issue #56 e ao inventário GSC #3. Sem main, deploy, DNS ou custo adicional.
