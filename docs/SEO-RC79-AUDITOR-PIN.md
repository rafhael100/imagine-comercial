# Comercial — consumir o auditor Imagine SEO RC79

## Por que o pin muda

O workflow principal do Comercial F354 ainda executava o auditor F103,
`0d849f0b30813da1a64cbb50748138765f144151`. A cadeia do Engine passou a detectar
falhas adicionais de metadados e de indexação, mas elas não eram consumidas
por esse workflow do site.

Esta promoção fixa o Engine em
**`3af252f33c7ef365137853f60aef84b42228d8c6`**,
SHA da [integração F208](https://github.com/rafhael100/imagine-seo-engine/pull/312)
que compila e examina o Comercial F348/F354 por revisões imutáveis. O pin
permanece um SHA completo, sem branch móvel ou credencial persistida.

## O que chega ao consumidor

- F203/F204: prazo absoluto e recusa de cabeçalhos HTTP ambíguos nos laboratórios.
- F205/F206: leitura de metadados e de HEAD/BODY sem ocultar diretivas após
  textos literais em scripts, atributos ou RCDATA.
- F207: inspeção de X-Robots-Tag na evidência HTTP, separada da paridade de bytes.
- F209: robots/Googlebot no BODY e marcador editorial privado.

O workflow principal continua executando a suíte completa do Engine e a
auditoria **offline** do próprio `dist`, com `--fail-on-warnings`,
`--strict-public-head`, `--multilingual` e `--check-hreflang`. A checagem HTTP
de F207 tem suas provas específicas nos laboratórios do Engine; trocar o pin
não transforma o comando offline em auditor de uma VPS ou site publicado.

## Evidência e aceitação

Antes desta promoção, a suíte local do Engine aprovou **935/935 testes** e o
Comercial F354 aprovou **1055/1055**. Os builds F348/F354 têm 63 páginas públicas
auditadas, sem erros ou avisos no auditor atualizado, e nenhuma mudança de
rotas. A F208 verifica também o resumo inicial dos serviços em PT/EN/ES e
recusa nove mutações do HTML compilado.

A CI desta PR deve executar novamente os contratos do consumidor, o build,
a suíte da SHA exata do auditor e a auditoria do HTML, além dos controles
nativos de navegador. Os links e resultados finais pertencem à PR da SHA
executada; resultados anteriores não substituem esta verificação de consumo.

As expectativas existentes em `seo-audit-pin.test.mjs` e
`ci-immutable-actions.test.mjs` acompanham o pin autorizado. Os workflows
históricos com outras versões do Engine permanecem como evidência histórica.

## Limites

A alteração é limitada ao pin, suas duas expectativas de teste e este
documento. Não modifica páginas, preços, contratos, checkout, Portal ou
configuração de infraestrutura. CI verde não autoriza merge, DNS, publicação,
indexação, GSC real ou cobrança. Permanecem os gates operacionais dos projetos.

**DRAFT / REVIEW ONLY / NO-MERGE / NO-DEPLOY.**
