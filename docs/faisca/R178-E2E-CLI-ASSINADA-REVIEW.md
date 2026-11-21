# Faísca R178 — prova da CLI offline assinada em checkout Git descartável

**DRAFT / NÃO PUBLICAR.** Base R177. Todos os valores de teste são sintéticos, não há chave OpenAI ou contato com provedor/CRM/Portal/Sites/VPS.

## Objetivo

R175–R177 já validavam assinatura, hashes, replay e verificação Git em testes separados. A R178 adiciona um teste **de ponta a ponta do executável verdadeiro**, em vez de inspecionar apenas o texto do script. O runner cria um checkout Git novo e privado fora do repositório, copia somente os módulos privados e o script de auditoria, registra um commit local fictício e exige HEAD/index limpos. Não edita main, não usa Git remoto e não cria branch adicional na execução.

Em diretórios temporários 0700 são preparados três JSON numéricos canônicos, com arquivos 0600, pins SHA-256 calculados separadamente, um par Ed25519 efêmero e uma declaração de revisão humana **fictícia**. O teste invoca o executável com ambiente mínimo e CI vazio somente dentro desse checkout descartável, para exercitar o fluxo condicionado ao operador; nenhum serviço real é acessado.

## Critérios automáticos

1. Uma única auditoria assinada obtém relatório numérico com independentReviewWitnessVerified=true, providerUsageReconciled=false, externalAttestationVerified=false, publicReady=false e código de saída 2 (ainda não é GO).
2. Uma segunda execução com a mesma assinatura/nonce não emite relatório; falha por replay, mesmo após terminar o primeiro processo.
3. Auditoria sem assinatura continua explicitamente não verificada, e entradas parciais, adulteradas ou com nonce divergente não consomem registro.
4. Arquivo alterado depois da geração dos pins é rejeitado **antes** de consumir nonce.
5. Saídas não revelam nonce, caminhos internos, declaração assinada ou chave pública.

Comando: node --test tests/faisca-r178-private-signed-operator-e2e.test.mjs. A CI também executa suítes Node/HTTP/Chromium/axe, integração Portal/Onepage, PHP, PostgreSQL efêmero e SEO/build.

**Limites:** uma chave Ed25519 gerada pelo próprio teste não demonstra revisão humana real. O agregado da OpenAI continua sintético. O bloqueio de replay é apenas local ao diretório privado e não substitui registro multi-host, reconciliação independente do faturamento, revisão AppSec/LGPD/FinOps/editorial ou homologação acumulada privada R95+. As homologações e testes pagos Luna/Terra manuais anteriores não são repetidos. Sem merge, deploy, DNS/VPS, ativação pública, dados reais, leads, tickets ou cobrança. Mascote/site público/main/publicFaiscaEnabled=false preservados.
