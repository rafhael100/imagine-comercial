# Faísca R233 — recusar subárvores vazias fora do inventário

## Lacuna reproduzida

A R232 passou a limitar profundidade e entradas por diretório, mas `isSafeDirectory` permite nomes arbitrários sob `site/`. O manifesto R38 registra **somente arquivos**, portanto um novo diretório vazio sob `site/` — ou uma cadeia de diretórios vazios — preservava todos os hashes, contagens e tamanho e podia ser aceito na verificação. Esse caso não é coberto pela rejeição de diretório inesperado no topo.

## Correção fail-closed

O verificador e o gerador de snapshot passam a exigir pelo menos um arquivo inventariado em toda subárvore aceita. O teste negativo inclui diretório vazio em `site/`, um descendente vazio de rota privada e uma cadeia aninhada; o caso legítimo R38 é preservado. Limites de tamanho, número de entradas, links, SHA-256, Nginx, Compose, CSP e autenticação continuam vigentes.

Comandos executáveis no checkout isolado:

```bash
node --test tests/faisca-r38-private-staging-kit.test.mjs
npm test
npm run test:browser
```

## Alcance e gates

A proteção não assina a origem do kit, não detecta todos os tipos de corrida entre renomeação de diretórios nem valida a implantação real na VPS. O manifesto e seus hashes ainda exigem origem independente e pin de SHA obtido por canal confiável. Conferir CI na HEAD exata, revisar AppSec/privacidade e validar `nginx -T` / HTTP 401/403 somente no staging privado autorizado antes de qualquer GO.

R95–R233 **não estão presumidas instaladas** na VPS. A homologação R92 e os testes pagos Luna/Terra relatados pelo operador não foram repetidos. Somente fixtures sintéticas; sem credenciais, dados reais, merge, deploy, alterações VPS/DNS, CRM/Portal/Sites operacional ou cobranças. Preservar `main`, mascote aprovado, site público e `publicFaiscaEnabled=false`. **NO-GO público.**
