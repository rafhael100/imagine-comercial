# Integração de evidência HTML ativa e seleção do Googlebot

## Revisões integradas

Esta revisão parte do [Comercial #461](https://github.com/rafhael100/imagine-comercial/pull/461),
commit `5dcd780a2056fc4b973b2d8ed8feaa2d0736825c`, que exige evidência de HTML
ativo nos contratos locais de SEO, JSON-LD, títulos e links.

O auditor independente passa de
`e9a6f0faf757e0abc26c0f88e59cbca2a9f03af7` para
`2f77051e04266a9ae64bbdb48d7cd951a00d455e`, do
[Engine #323](https://github.com/rafhael100/imagine-seo-engine/pull/323).
Esse commit inclui o [Engine #322](https://github.com/rafhael100/imagine-seo-engine/pull/322):
seleção correta de variantes do Googlebot e preservação de declarações HTML
como faixas opacas entre os passes do auditor.

O SHA é fixado no workflow e nos dois testes que verificam sua imutabilidade.
O pin do emissor Portal, as Actions por SHA, as permissões somente de leitura
e as flags de auditoria estrita, idiomas e hreflang permanecem.

## Ensaio de robots sobre o Astro compilado

`scripts/test-pinned-robots-path-gate-ci.mjs` copia o `dist` real e exige um
baseline sem erros ou avisos. Cada cenário deriva do robots original:

| Cenário | Resultado exigido |
| --- | --- |
| Grupo genérico bloqueia `/servicos/` | Recusa pelo bloqueio da subárvore de serviços |
| `Googlebot/2.1` bloqueia `/servicos/` | Mesma recusa para o Googlebot geral |
| `Googlebot*` bloqueia `/servicos/` | Mesma recusa para o Googlebot geral |
| Allow do `Googlebot/2.1` sobre Disallow genérico da raiz | Zero erros e avisos |
| Bloqueio exclusivo de `Googlebot-Image` | Zero erros e avisos para o crawler geral |

Nos três bloqueios, o ensaio exige ocorrência em `servicos/index.html` e
restringe todos os erros ao tipo `robots_block_public_page` dentro de
`servicos/`. A home não pode ser reportada e não pode aparecer bloqueio global.

O pin anterior falhou no novo ensaio sobre o build real: não detectava o
bloqueio específico de `Googlebot/2.1`. O pin corrigido aprovou os cinco
cenários, incluindo os dois controles que devem continuar aceitos.

## Ensaio de declarações sobre o Astro compilado

`scripts/test-pinned-html-declaration-gate-ci.mjs` também usa uma cópia
descartável do `dist`. Seleciona os SCRIPT JSON-LD reais de `/servicos/` e
insere, antes das aberturas, três prefixos: DOCTYPE SYSTEM citado, declaração
desconhecida e instrução de processamento. O primeiro `>` passa a encerrar a
declaração. Os bytes posteriores e as outras rotas ficam preservados.

Os verificadores têm responsabilidades diferentes, comprovadas separadamente:

| Mutação, repetida para os três prefixos | Contrato local | Engine independente |
| --- | --- | --- |
| Somente a abertura da Organization é absorvida | Recusa por Organization ausente | Zero erros e avisos; reconhece os JSON-LD posteriores |
| Todas as aberturas JSON-LD da rota são absorvidas | Recusa por Organization ausente | Exatamente um aviso `missing_jsonld` em `servicos/index.html` |

O Engine é genérico: não exige o tipo Organization. Seu aviso de ausência de
JSON-LD é suficiente para reprovar a política `--fail-on-warnings` do workflow.
O contrato local exige a Organization mesmo quando WebPage e BreadcrumbList
continuam ativos. Assim, os testes não atribuem ao Engine uma validação que
pertence ao Comercial.

Cada caso restaura a rota em `finally`, e o ensaio confere o HTML original ao
final. A cópia temporária é removida. O pin anterior falhou nesse gate ao
aceitar as aberturas fictícias dentro de DOCTYPE sem emitir `missing_jsonld`.
O pin corrigido aprovou os seis cenários.

## Validação e reprodução

- Dependências instaladas por `npm ci --no-audit --no-fund`.
- Suíte Comercial da integração: **1.113 testes aprovados**, zero falhas,
  cancelamentos ou skips.
- Engine fixado: **1.156 testes aprovados**; sua CI offline também confirmou
  esse total em Node 22 e Node 24.
- Build Astro: **64 páginas**, incluindo a página 404.
- `verify-dist.mjs`: **63 páginas públicas**, sitemap e robots aprovados.
- Auditoria independente estrita: **63 páginas, zero erros e zero avisos**,
  com idiomas e hreflang verificados.
- Os dois ensaios sobre cópias do build passaram no pin final e reproduziram
  a regressão esperada no pin anterior.
- Revisão independente dos scripts, do pin e da posição do step sem bloqueios.

Após instalar as dependências, executar a suíte e compilar o Astro, o checkout
em `.qa/seo-engine` deve resolver para o SHA exato documentado acima:

```sh
node scripts/verify-dist.mjs
node .qa/seo-engine/scripts/audit-dist.mjs dist https://imaginecomunicacao.com.br/ --fail-on-warnings --strict-public-head --multilingual --check-hreflang
node scripts/test-pinned-robots-path-gate-ci.mjs
node scripts/test-pinned-html-declaration-gate-ci.mjs
```

O novo step de declarações fica depois da auditoria pristine e do gate de
robots, antes dos ensaios que alteram temporariamente o catálogo. A CI desta
integração deve ser avaliada no próprio commit, sem herdar como prova apenas
os resultados isolados das duas dependências.

Os dados são sintéticos e o build é de laboratório. Esta revisão não contém
coletas privadas e não altera o domínio, os redirects ou serviços operacionais.
As verificações não demonstram indexação, ranking ou homologação de produção.
