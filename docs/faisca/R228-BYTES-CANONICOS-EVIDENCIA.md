# Faísca R228 — bytes canônicos na auditoria offline privada

## Lacuna e alteração

A auditoria numérica offline R167–R227 lê três arquivos locais `before.json`, `after.json` e `aggregate.json`, confere `SHA-256` independentes quando fornecidos e validava a representação JSON comparando **strings decodificadas**. `Buffer.toString('utf8')` aceita substituição silenciosa de bytes UTF-8 inválidos por `U+FFFD`; equivalência entre strings não garante equivalência entre os bytes originais. Um digest correto dos bytes não transforma uma codificação inválida em JSON canônico.

A R228 introduz `TextDecoder('utf-8', { fatal: true })` e, depois do parse JSON, exige **igualdade byte a byte** entre o buffer efetivamente lido e `Buffer.from(JSON.stringify(value) + '\\n', 'utf8')`. Isso preserva os controles anteriores de file descriptor, `O_NOFOLLOW`, tamanho, duas leituras, metadados, hashes independentes e schema numérico; acrescenta rejeição de UTF-8 inválido, BOM e normalização silenciosa. Erros do parser e paths continuam mascarados.

## Ensaios sintéticos

Em checkout isolado, Node >=22.12:

```bash
node --test tests/faisca-r228-canonical-offline-bytes.test.mjs
node --test tests/faisca-r171-independent-evidence-pins.test.mjs tests/faisca-r227-independent-pin-snapshot.test.mjs
```

Fixtures recriam somente três JSONs numéricos, em diretório temporário 0700, arquivos 0600. Exercitam caso legítimo NO-GO, UTF-8 inválido com pin correto, BOM com pin correto e CRLF com pin correto. Testes HTTP/Chromium/axe existentes na CI continuam obrigatórios; não foram enfraquecidos.

## Gates inalterados

Revisão AppSec/LGPD/FinOps/editorial, homologação acumulada privada R95–R228 na VPS e reconciliação externa do Usage/faturamento **continuam pendentes**. Esta PR não possui acesso a credencial, não faz chamada paga, não instala staging e não certifica autenticidade da informação do provedor. É somente defesa em profundidade no leitor offline.

**NO-GO público:** `main`, site, mascote e `publicFaiscaEnabled=false` preservados. Sem merge, deploy, VPS, DNS, endpoints públicos, CRM/Portal/Sites operacional, cliente real, lead, ticket ou cobrança.
