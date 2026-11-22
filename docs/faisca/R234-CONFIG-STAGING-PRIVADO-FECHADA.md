# Faísca R234 — perímetro de staging estático com configuração efetiva fechada

## Problema demonstrado

A verificação anterior conferia marcadores obrigatórios e algumas diretivas ativas de Nginx, mas um kit alterado, com manifesto e SHA-256 recalculados pelo próprio adversário, ainda podia adicionar uma rota não revisada ou sobrescrever a política de Docker Compose. Exemplos: uma nova `location`, `privileged: true`, `network_mode: host` ou outra chave `ports` com bind público.

A presença de `auth_basic`, CSP e `127.0.0.1:4337:8080` em algum ponto do arquivo não impede overrides posteriores. Essa lacuna é importante em pré-homologação, mesmo quando a identidade da fonte do kit será fixada por canal externo.

## Controle de laboratório

`verify-kit.mjs` mantém uma **lista ordenada e fechada das diretivas efetivas** revisadas para Nginx e Compose (sem comentários e linhas em branco). A verificação recusa diferenças de diretivas ou ordem, independentemente de hashes autorrelatados no manifesto. Mudanças legítimas nesses arquivos exigem revisão consciente e atualização dessa lista. Mantém as demais verificações: limites de arquivos/árvore, FD sem seguir symlinks, SHA-256, manifesto fechado, headers, autenticação e `publicFaiscaEnabled=false`.

Os testes reconstroem kits sintéticos com hashes recalculados e injetam uma `location` não revisada, privilégios/host networking e portas públicas; confirmam rejeição e controle positivo legítimo. Comandos:

```bash
node --test tests/faisca-r38-private-staging-kit.test.mjs
npm test
npm run test:browser
```

## Limites de confiança / GO-NO-GO

Esta é uma conferência **offline**, não um parser Nginx/YAML completo nem um comprovante de implantação. O operador deve obter SHA e artefato por **fontes independentes**, verificar `nginx -T` / `docker compose config` e realizar testes HTTP 401/403 no staging privado autorizado, inclusive ausência de portas públicas, sem reutilizar credenciais em evidências. O controle não equivale a revisão AppSec/LGPD/FinOps/editorial, reconciliação externa ou publicação.

Os testes pagos Luna/Terra e a R92 previamente relatados não foram repetidos. R95–R234 **não estão presumidas instaladas** na VPS; esta branch não realiza deploy, merge, DNS, operações CRM/Portal/Sites, lead, ticket ou cobrança e não utiliza dados reais nem chaves. Manter mascot e site público, `main` e `publicFaiscaEnabled=false` intactos. **NO-GO público.**
