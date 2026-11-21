# Faísca R167 — conferência offline numérica pelo operador (REVIEW ONLY)

## Entrega

A R165 verifica apenas a compatibilidade numérica entre dois extratos locais de reservas R160 e um agregado reduzido do provedor. A R167 cria um ponto de entrada de **conferência somente leitura**, de propósito limitado, para permitir ao operador autorizado reunir esses três valores **fora do GitHub**, sem passar mensagens, tokens, faturas, identidade de clientes ou exportações da conta inteira para a ferramenta.

Arquivos fixos e separados, fornecidos pelo operador em um diretório local real de permissão 0700, com arquivos 0600: `before.json` e `after.json` devem ter o schema **exato** `faisca.private-ledger-readonly-snapshot.v1`; `aggregate.json` deve ter o schema exato `faisca.private-provider-aggregate-evidence.v1` e escopo `isolated_private_review_only`. Os três são JSON canônico `JSON.stringify(obj) + "\\n"`, com limite de 1024 bytes e somente campos explícitos. Arquivos não privados, links simbólicos, conteúdo duplicado, texto/PII e campos adicionais são rejeitados. O relatório não contém os valores originais, caminhos, mensagens, respostas, chaves ou nomes.

**A ferramenta não consulta OpenAI, não lê faturas, não prova origem dos agregados e não estabelece conciliação real**. Ela não preserva atômica a leitura entre processos/hosts e não autoriza uso de dados operacionais. Mesmo números coincidentes retornam `COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW`, `providerUsageReconciled:false` e `publicReady:false`. O CLI sai com código 2 se ainda requer revisão, 1 se houver bloqueio, nunca 0 como GO público.

## Execução futura por operador autorizado, exclusivamente offline

A revisão independente precisa fixar a HEAD exata em um checkout isolado, limpo e sem mudanças concorrentes. O CLI rejeita CI e exige confirmação local e SHA de 40 caracteres:

```bash
export FAISCA_PRIVATE_PROVIDER_AUDIT_ACK=YES_OFFLINE_NUMERIC_REVIEW_ONLY
export FAISCA_PRIVATE_PROVIDER_AUDIT_DIRECTORY=/caminho/privado/revisao
node scripts/faisca-private-provider-offline-audit.mjs <SHA-REVISADA> success
```

O argumento final pode ser `success`, `rejected`, `failed_luna` ou `failed_terra`. O CLI somente compara os três arquivos existentes; **não cria, modifica ou remove** dados nem tenta novas chamadas pagas. Não executar na VPS ou instalar sem autorização operacional própria. O arquivo de agregado deve ser preparado pelo operador a partir de uma janela isolada e examinada por fonte independente, sem transferir documentos com dados reais para o repositório.

## Validação sintética

```bash
node --test tests/faisca-r167-provider-operator-audit.test.mjs
npm test
```

As fixtures são fictícias e não usam rede, credenciais, CRM/Portal/Sites, leads, cobrança ou tickets. A CI prova formato e bloqueios, não autenticidade ou faturamento do provedor. R92 e testes pagos anteriores não são repetidos. Faltam homologação acumulada em staging, revisão AppSec/LGPD/FinOps/editorial e evidência operacional independente. Preservar `main`, site público, mascote e `publicFaiscaEnabled=false`; sem merge, deploy, VPS/DNS ou GO público.
