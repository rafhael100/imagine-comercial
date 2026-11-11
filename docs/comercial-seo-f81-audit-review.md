# Comercial × SEO-F81 — Validação de atualização de SHA (somente revisão)

O workflow `.github/workflows/commercial-seo-f81-parity-review.yml` verifica **em paralelo** dois códigos do motor SEO contra **o mesmo build local do Imagine Comercial**:

- Versão atualmente pinada no workflow comercial: `bbcc198b5eb88585534c0a0374ed8c787f40e7ca`.
- Candidata SEO-F81: `10a649f9c448fe8412da6e8c499eec0637d9259e` ([SEO PR #117](https://github.com/rafhael100/imagine-seo-engine/pull/117)), RC33 + correção de contagem de ocorrências repetidas e bloqueio de opções/flags desconhecidas.
- O workflow valida os SHAs reais, executa a suíte completa offline F81, compila o site Astro atual e confronta `summary`, inventário de rotas, erros e avisos de duas auditorias estáticas.
- Em teste sintético separado, o gate F81 precisa recusar uma regressão de **1 para 3 avisos da mesma categoria no mesmo arquivo**, com `newWarnings=2` e nenhum vazamento de mensagens privadas.

Esta PR **não modifica o PIN atual do CI oficial** do Comercial, não atualiza dependências de produção, não conecta o Search Console real e não executa deploy, DNS, redirects ou cobrança. Os arquivos JSON temporários são removidos ao finalizar; não são artefatos de CI nem contêm dados de clientes.

**Critérios antes de promover:** CI com sucesso ou diagnóstico de divergência, revisão independente AppSec/SEO, aceite do novo SHA em uma PR de atualização separada, testes do Comercial contra o build exato da release e revisão de rollback. Permanece **DRAFT/NO-GO** e não mescla em main.
