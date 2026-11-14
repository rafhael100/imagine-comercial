# Gateway e fonte comercial — decisão 14/11/2026

O titular escolheu **Asaas** e solicitou recuperar os preços aprovados da versão Node e do motor Imagine Performance AI.

Fonte canônica: [Portal PR #737](https://github.com/rafhael100/imagine-portal/pull/737), atualização `a6114ee2dfcc453b998519235fe9e66bdc5baca2`. Arquivos:

- `docs/decisions/2026-11-14-asaas-and-legacy-pricing.md` — decisão e condições recuperadas.
- `docs/decisions/approved-commercial-catalog.json` — referência estruturada da migração.
- `docs/decisions/2026-11-14-landing-performance-pricing-research.md` — pesquisa histórica e divergência das propostas Performance.

**Correção da pesquisa inicial:** a oferta Landing Page foi encontrada em `docs/OFERTA-LANDING-PAGE.md` no Node histórico `rafhael100/imagine-portal@76ce533da42bf5d195ebffcdc8a110d1bc70f9b8`, IN-115. Portanto, ela possui definição comercial aprovada para planejamento; não deve permanecer classificada como preço inexistente. Valores e complementos estão na fonte Portal, sem tabela financeira independente no Comercial.

A fonte também atualiza novas ofertas Onepage/Landing Page: conteúdo em blocos existentes incluído na mensalidade, extras estruturais sob orçamento, e preservação dos contratos legados. Não reaplicar indiscriminadamente a antiga exclusão de toda alteração.

Em Performance, foram localizadas diferentes famílias de valores nos documentos do motor `b152687b7e3c06543ccad8c938d74a9bc612b12f`, expressamente classificadas como propostas/simulações. A afirmação atual do titular de que os valores já foram definidos exige reconciliar qual tabela corresponde à decisão vigente; não misturar modelos ou converter exemplos em preços operacionais. A pesquisa preserva números, fórmula, fontes e regras de adicionais, sem preencher checkout com valor escolhido por suposição.

O Portal administra oferta versionada, titularidade, contrato, cliente Asaas, cobranças, recorrência e conciliação. O Comercial deve consumir a oferta publicada pelo Portal e conduzir ao checkout correspondente. Preço do navegador não é autoridade financeira. A decisão não ativa pagamentos, chaves, fiscal ou provisionamento e não comprova implementação Laravel finalizada.

Próxima implementação: homologar sandbox, versão contratual, vínculo Comercial/Portal e retorno financeiro idempotente; resolver a tabela Performance antes de permitir sua cobrança direta. Esta PR permanece documental e em revisão.
