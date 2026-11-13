# F145 — Artigos editoriais com contato contextual

## Conversão sem captura
- `articleContactIntent` lê exclusivamente o catálogo de artigos e os links já revisados para serviços publicados.
- O CTA no fim de cada artigo abre `/contato/#slug-do-servico` para pré-selecionar a solução correlata.
- Mantém link independente de **orientação geral** para quem não deseja pré-selecionar serviço.
- Não transmite dados automaticamente, não gera POST nem grava identificação, consentimento ou informações de visitantes.
- Artigos com links não relacionados a serviços recebem somente o fallback genérico, sem inferir uma contratação.
- Não há vinculação a preços, garantias, campanhas, perfis pessoais ou ranking.

## Evidência de desenvolvimento
- Teste de contrato percorre o catálogo, confere whitelist exata dos serviços e usa o auditor de links F32.
- Teste negativo recusa objetos e slugs não provenientes do catálogo.
- QA Chromium em 375px/1440px abre o guia de Landing Page x site e verifica pré-seleção segura no contato.
- Revisão editorial e publicação ainda dependem dos gates existentes.

**Estado:** PR draft empilhada sobre F142. Nenhum merge main, deploy, DNS, 301, dados GSC reais ou novas despesas.
