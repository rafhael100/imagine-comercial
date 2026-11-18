# Faísca R02 — autorização de publicação do pacote

Referência: 17/11/2026, America/Sao_Paulo.

## Autorização recebida

Após receber a demonstração, o ZIP R02 e a explicação do bloqueio anterior, o titular declarou: **“autorizado, aprovado pode publicar o mascote e os documentos”**.

O contexto imediatamente anterior identificava o destino público `rafhael100/imagine-comercial` e o conteúdo do pacote R02. A autorização permite publicar o PNG aprovado, os documentos e o código correspondente em branch própria de revisão e PR DRAFT. O bloqueio anterior de falta de autorização específica fica registrado como histórico superado por esta instrução.

Merge, deploy operacional do site, alteração de VPS/DNS, contratação de serviço pago, conexão a modelo pago e uso de dados reais continuam fora deste escopo. A autorização de publicação em GitHub não declara homologação do Faísca.

## Origem e base de publicação

- Entrega original: R02 local sobre Comercial #450, SHA `d38a4fc353bdfa277c47df4a46872fcd1c96f2d1`.
- Candidata atual revalidada: Comercial [#451](https://github.com/rafhael100/imagine-comercial/pull/451), SHA `a4f4eb9687b6dfd9c0d45e88e8345cc37198cd6e`.
- Branch destinada à revisão: `feat/faisca-r02-public-review-2026-11-17`.
- As três alterações de #451 são do CLI de captura HTTP, seus testes e documentação; não conflitam com o incremento Faísca.
- A main permanece documental; não é a base funcional desta PR.

O PNG é exatamente o aprovado: SHA-256 `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`, 1.887.660 bytes. Metadados de procedência foram preservados. Não foram enviados logs brutos, histórico de conversas, credenciais ou dados de clientes.

## Revalidação para publicação

Com as dependências fixadas instaladas por `npm ci --offline --no-audit --no-fund`, a suíte local sobre a base #451 passou com **1.101 testes, zero falhas e zero skips**, incluindo os **29 testes do Faísca**. O aumento de cinco testes em relação ao relatório original decorre da base #451.

As evidências locais anteriores permanecem descritas em `VALIDACAO-R02.md`. O código segue como demonstração guiada, sem LLM real, Portal, CRM ou pós-venda autenticado conectados. A revisão independente de pré-publicação conferiu os 28 arquivos originais: somente fixtures sintéticas, nenhum segredo utilizável e workflow restrito a leitura, com Actions em SHA imutável.

O navegador local não pôde iniciar neste ambiente. O workflow do pacote deverá executar os testes de navegador e axe no runner permitido; seus resultados devem ser consultados na SHA exata da PR. Não apresentar a preparação desses testes como aprovação antes da execução.

Este documento registra a autorização e a preparação. A existência do commit remoto e da PR deve ser confirmada pelos links efetivamente retornados pelo GitHub, sem presumir sucesso de envio.
