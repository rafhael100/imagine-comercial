# Comercial — auditor de indexação e precisão dos relatórios GSC

## Propósito e revisão fixada

O workflow principal passa a consumir a revisão
**`0eae548cf474c2932c66a933fa88e7d8b1ebc7d4`** do Imagine SEO Engine,
publicada na [PR #314](https://github.com/rafhael100/imagine-seo-engine/pull/314).
Ela sucede o pin RC79 `3af252f33c7ef365137853f60aef84b42228d8c6`
da [PR Comercial #445](https://github.com/rafhael100/imagine-comercial/pull/445).
O documento da RC79 continua preservado como evidência histórica.

## Correções incluídas

1. Metas `robots` e `googlebot` com `unavailable_after:` em HEAD ou BODY
   exigem revisão explícita de indexação, independentemente do relógio.
   O auditor mantém a distinção entre uma agenda que precisa de revisão
   e um bloqueio efetivo por `noindex`.
2. `max-image-preview: none`, inclusive com espaços, é reconhecido como
   restrição da prévia de imagem. O parâmetro não produz um falso `noindex`;
   diretivas autônomas `noindex`, `none` ou `nofollow` continuam detectadas.
3. Os relatórios GSC offline avaliam a queda de CTR de dois pontos
   percentuais com os contadores originais, sem decidir o limiar por valores
   arredondados. O limite e a exigência de pelo menos 100 impressões em ambos
   os períodos continuam os mesmos; cobertura incompleta não emite sinal.
4. O cruzamento consulta/página reaproveita a identidade Unicode já usada
   pelo Engine. Grafias equivalentes em NFC/NFD não ocultam sobreposição
   entre páginas nem permitem somar o mesmo par duas vezes. Consultas com
   acentos semanticamente distintos permanecem distintas.

As duas primeiras correções afetam a auditoria do HTML compilado. As duas
últimas são cobertas pela suíte completa do Engine executada no consumidor;
o workflow não consulta Google nem recebe dados reais do Search Console.

## Escopo e validação

A alteração limita-se ao pin de `.github/workflows/validate.yml`, às duas
expectativas existentes de teste e a este documento. Mantém Actions em SHA
completo, `contents: read`, `persist-credentials: false` e a auditoria com
`--fail-on-warnings --strict-public-head --multilingual --check-hreflang`.

A revisão do Engine contém 53 novos testes de regressão. O resultado remoto
de cada consumidor deve ser conferido na sua própria SHA; a validação do
Engine e a validação do build Comercial são evidências distintas.

### Resultado local em 17/11/2026

Em Node **24.22.1**, com entradas sintéticas e dependências já instaladas por
`npm ci --no-audit --no-fund`:

- Testes existentes de pin e supply chain: **6/6 aprovados**.
- `npm test`: **1055/1055 aprovados**, sem falhas, cancelamentos ou skips.
- `npm run build`: **64 páginas geradas**, incluindo a página 404.
- `npm run check:dist`: **63 páginas públicas** e sitemap/robots validados;
  o controle de ausência de captação pública examinou 75 arquivos HTML/JS.
- Auditor atualizado sobre esse `dist`, com os quatro flags estritos:
  **63 páginas, zero erros e zero avisos**; todas alcançáveis, sem páginas
  órfãs e profundidade máxima de três cliques.

Navegador e PostgreSQL não foram executados neste ensaio local. Suas provas
ficam na CI própria da futura PR de consumo; os resultados acima não devem
ser apresentados como conclusão desses jobs ou como homologação da VPS.

## Gates preservados

Testes, builds e auditorias offline não comprovam ranking, tráfego,
indexação Google, OAuth por empresa nem homologação de infraestrutura.
Permanecem os requisitos de revisão independente, conexão própria do
Portal com consentimento e custódia de tokens, staging autorizado,
backup/restauração/rollback e aprovação humana de release.

Nenhuma página, preço, contrato, checkout, permissão ou regra comercial
é alterada nesta promoção. Não há execução de banco, navegador, VPS,
DNS, cobrança, publicação ou consulta Google neste recorte local.

**DRAFT / REVIEW ONLY / NO-MERGE / NO-DEPLOY / NO-DNS / NO-INDEX.**
