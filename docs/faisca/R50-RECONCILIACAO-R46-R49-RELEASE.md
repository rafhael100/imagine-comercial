# Faísca R50 — reconciliação final da cadeia R46–R49 sem alterar a árvore do produto

**Origem:** [R49 #513](https://github.com/rafhael100/imagine-comercial/pull/513) e [R46 #510](https://github.com/rafhael100/imagine-comercial/pull/510), ambas com PRs draft; a R49 adiciona o protocolo mínimo de bytes candidato-only para IA sem dados de visitantes.

## Divergência encontrada

A R47 foi iniciada antes dos três últimos commits da R46, relativos à prova de degradação em Nginx, ao teste de navegação para `#conteudo` e à auditoria de hashes do Comercial F357. Esses arquivos foram **transportados funcionalmente** para a linha R47–R49; contudo, o histórico Git ainda marcava a R46 final como três commits atrás da R49.

Os blobs foram comparados diretamente em todos os três caminhos:
- `ops/faisca/staging/nginx-browser-qa.mjs`;
- `scripts/browser-qa.mjs`;
- `tests/faisca-r39-commercial-f357-merge.test.mjs`.

Todos os três arquivos da R49 tinham **hashes Git idênticos aos da R46 final**. Nenhuma correção precisava ser escolhida entre versões concorrentes.

## Reconciliação executada

Criado um commit Git de dois pais na branch de revisão `integration/faisca-r50-final-r46-r49-lineage-2026-11-19`:

- Commit de reconciliação: `82e3aa7d500cbc520a037359ffcc8908ff210efe`.
- Primeiro pai (R49): `bed6f6cdddd1332ea1f58de0260422b74f576b6d`.
- Segundo pai (R46 final): `e9e63daa980a16b40e2bd20c94b6da4056a5cacd`.
- SHA da árvore: `bfee93be48fadad8af5b8cc4735a34e4c93d99be`, **exatamente a árvore R49** antes da criação dos novos arquivos de teste/documentação R50.

A comparação GitHub `R46...merge` apresentou `behind_by=0`; a comparação `R49...merge` apresentou **zero diferenças de arquivos**. Não houve rebase destrutivo, force push ou alteração no mascote e na experiência validada R48–R49.

## Regra de regressão adicional

`tests/faisca-r50-release-merge-regression.test.mjs` confirma os controles reais da R46 (sem JS, chunk indisponível, teclado, skip-link e auditoria F357) e o contrato de privacidade da R49 (envelope mínimo, sem texto ou identificadores, recusa de clones, classificação fechada e replay sem nova chamada). Confirma também que o modo público Faísca continua desligado e o PNG aprovado é byte-idêntico.

## Próximo gate de release

A PR R50 deve passar em sua **SHA final** por todas as suítes relevantes. Somente depois, a candidata consolidada de revisão contra `main` poderá ser atualizada com **fast-forward**, mantendo `main` intacta. A revisão independente do Comercial/SEO e do Faísca, além de staging HTTPS protegido, backup/restauração, IAM/MFA, conexão Portal/CRM/PSP e aprovação do provedor de IA real continuam exigidas antes de qualquer publicação.

Nenhum merge na `main`, deploy, cobrança, custo, DNS, VPS, dado de cliente ou uso de LLM externa foi feito.
