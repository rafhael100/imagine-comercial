# Imagine Comercial

Site público comercial da Imagine Comunicação Digital — `imaginecomunicacao.com.br`.

**Decisão técnica aprovada (08/11/2026): Astro**, arquitetura **SEO-first** e **híbrida** (SSG como padrão; SSR controlado somente se necessário e após homologação). A prova de conceito comparativa com Next.js/Nuxt foi dispensada por decisão do responsável.

## Estado atual — RC31 de desenvolvimento (11/11/2026)

A versão mais recente do conjunto Comercial + SEO está na [PR draft #155](https://github.com/rafhael100/imagine-comercial/pull/155) e na branch `integration/comercial-rc31-functional-seo-2026-11-11`. Inclui SEO RC30, briefing guiado de contato F142, conversão contextual dos artigos F145 e laboratório de resposta HTTP incerta F148. A [PR #153](https://github.com/rafhael100/imagine-comercial/pull/153) consolidou as duas frentes **somente em desenvolvimento**.

Quatro workflows da candidata RC31 passaram em 11/11: [SEO/build/browser](https://github.com/rafhael100/imagine-comercial/actions/runs/43017859317), [PostgreSQL descartável](https://github.com/rafhael100/imagine-comercial/actions/runs/43017859315), [Workerd local](https://github.com/rafhael100/imagine-comercial/actions/runs/43017859539) e [Lighthouse local](https://github.com/rafhael100/imagine-comercial/actions/runs/43017859322). Veja o [STATUS-ATUAL.md](STATUS-ATUAL.md) para o registro cronológico e os bloqueios de lançamento.

**A `main` continua documental e o site legado permanece publicado.** F70, homologação de integração Portal/CRM, revisão de segurança/privacidade, GSC/crawl/URLs e autorização de produção não foram concluídos. Não ativar formulário público, criar redirects ou enviar dados privados com base nesses CIs. As seções abaixo são históricas e podem descrever etapas anteriores à RC31.

**Avanço complementar F149 (11/11):** [PR #156](https://github.com/rafhael100/imagine-comercial/pull/156) integrada somente na RC31 de desenvolvimento: testa desconexão HTTP pós-commit no PostgreSQL descartável e reenvio sem duplicação. [Detalhes e bloqueios de release](STATUS-ATUAL.md). Nenhum merge em `main` ou deploy foi executado.

## Responsabilidades
- Páginas comerciais, conteúdo indexável, experiência de conversão e CTAs para o Portal Imagine.
- Core Web Vitals, acessibilidade, metadados, dados estruturados fidedignos, sitemap e URLs canônicas.
- Catálogo publicável e CMS **gerenciados pelo Portal**; o Portal é autoridade sobre identidade, contratos, preços oficiais, checkout, pagamentos e documentos fiscais.
- Imagine SEO Engine separado analisa, monitora e propõe otimizações; não é dependência de disponibilidade do site.

## Estado e segurança
Repositório inicializado documentalmente. **Sem site em produção, DNS modificado, integração real com Portal, SEO Engine, Search Console, pagamento, clientes, credenciais ou dados reais.**

Todo código funcional deve entrar por branch isolada e PR draft, com testes e revisão; sem merge/deploy automático. Não incluir dados pessoais, tokens ou chaves no repositório público.

Diretrizes transversais:
- https://github.com/rafhael100/imagine-portal/issues/99
- https://github.com/rafhael100/imagine-portal/issues/100
- https://github.com/rafhael100/imagine-portal/issues/102

## Estado do desenvolvimento (10/11/2026)
A implementação Astro e os testes avançados estão na [branch de integração em revisão](https://github.com/rafhael100/imagine-comercial/pull/38), até F50, e **não na `main`**. O site legado em `imaginecomunicacao.com.br` não foi substituído. A revisão de catálogo assinado, SEO/Chromium, Workerd local e Lighthouse funciona em laboratório, mas não corresponde a tráfego real nem a publicação efetiva.

A F49 acrescentou uma proposta de migração PostgreSQL e adaptador de reserva de recibos; a F50 o conectou ao ensaio Astro com um cliente **simulado**, ainda sem PostgreSQL ou witness remoto reais. A migração não foi executada. O [issue #56](https://github.com/rafhael100/imagine-comercial/issues/56) registra a homologação privada Leaseweb, o banco, as autorizações do Portal e a entrega independente. A auditoria SEO real está no [issue #3](https://github.com/rafhael100/imagine-comercial/issues/3) e os contratos de conteúdo do Portal no [issue #4](https://github.com/rafhael100/imagine-comercial/issues/4).

**Proibido presumir aprovação de produção:** faltam staging privado, credenciais seguras, grants/MFA, ledger durável, Search Console e crawl reais, revisão editorial/jurídica/comercial e autorização humana de merge/deploy/DNS. Não incluir dados de clientes, credenciais ou chaves de assinatura em arquivos públicos.

## Marco de laboratório F53 — 10/11/2026

O [PR de integração #38](https://github.com/rafhael100/imagine-comercial/pull/38) passou por Astro/SEO, Cloudflare Workerd, Lighthouse local e **PostgreSQL 16 real, mas exclusivamente em banco descartável do GitHub Actions**. A cadeia testada inclui catálogo e HTML Astro assinados, pins de SHA-256, política de witness Ed25519 assinada por raiz separada e anti-replay no PostgreSQL. Consultar [F51](https://github.com/rafhael100/imagine-comercial/pull/62), [F52](https://github.com/rafhael100/imagine-comercial/pull/64) e [F53](https://github.com/rafhael100/imagine-comercial/pull/65).

**O site existente não foi substituído.** Esses testes não certificam o banco da VPS Leaseweb, testemunha pós-entrega remota, autenticação/MFA/grants operacionais do Portal, integrações duráveis do CRM, GSC real, preços/contratos/privacidade, deploy ou DNS. Continuam pendentes os gates [#56](https://github.com/rafhael100/imagine-comercial/issues/56), [#3](https://github.com/rafhael100/imagine-comercial/issues/3) e [#4](https://github.com/rafhael100/imagine-comercial/issues/4). A `main` permanece documental.

## Atualização F55–F57 — verificação e permissões (10/11/2026)

O [PR integrado de revisão #38](https://github.com/rafhael100/imagine-comercial/pull/38) inclui agora a F55: PostgreSQL real em GitHub-hosted CI com duas funções `SECURITY DEFINER` para política assinada e nonce, papel `EXECUTE` sem acesso direto às tabelas e verificação de assinatura Ed25519 feita no processo Node. A F56 fixa o [auditor independente Imagine SEO RC10](https://github.com/rafhael100/imagine-seo-engine/pull/45) por commit SHA e usa `--fail-on-warnings --strict-public-head`. A F57 reforça a prova negativa dos privilégios SQL e registra esta passagem de desenvolvimento.

**Nenhuma dessas etapas é homologação operacional.** A integração não tem credenciais Leaseweb, Portal/CRM autênticos, witness que leu arquivos publicados, dados reais de GSC nem revisão final de domínio, conteúdo e LGPD. A `main`, produção, DNS e bancos persistentes permanecem intactos.

## Nova jornada pública de soluções (F58–F59, 10/11/2026)

A página `/servicos/` agora tem um **orientador de serviços** acessível para escolher um objetivo de negócio e ver sugestões de formatos já presentes no catálogo: Onepage, criação de sites, Landing Pages, sites por assinatura e gestão de Google/Meta Ads. A indicação é apenas informativa: **não calcula preço, direito ou proposta**.

Os links da F59 permitem conhecer cada serviço ou seguir para `/contato/#slug`, preservando somente o identificador público do serviço. A página Contato seleciona o serviço e prepara uma mensagem nos links existentes de WhatsApp/e-mail; nenhuma mensagem é enviada sem ação explícita do visitante. Não há formulários, cookies, armazenamento, analytics ou conexão com Portal/CRM. Sem JavaScript, a lista completa de serviços e a sugestão inicial permanecem disponíveis.

As alterações estão nos [PRs #75](https://github.com/rafhael100/imagine-comercial/pull/75) e [#76](https://github.com/rafhael100/imagine-comercial/pull/76) e na branch [PR #38](https://github.com/rafhael100/imagine-comercial/pull/38) **review-only**. O auditor independente passou ao SEO RC12 pinado por SHA ([ensaio #74](https://github.com/rafhael100/imagine-comercial/pull/74)). A `main`, o domínio atual, DNS e ambientes de clientes seguem inalterados.

O lançamento continua dependente da [homologação Leaseweb/Portal/CRM #56](https://github.com/rafhael100/imagine-comercial/issues/56), [migração SEO e URLs históricas #3](https://github.com/rafhael100/imagine-comercial/issues/3), contratos do Portal #4 e confirmação de canais, preços, textos e documentos jurídicos.

## Comparação pública de soluções (F60) e SEO RC13 (F61)

O site em revisão dispõe da página `/comparar-solucoes/`: ela explica quando considerar Onepage, criação de sites, Landing Pages, assinatura, Google Ads ou Meta Ads. Os seis cartões incluem contexto da escolha, organização típica, perguntas para o briefing e links internos para detalhes ou contato. A página é estática, acessível e funciona sem JavaScript. Não substitui proposta, não inventa valores nem coleta leads.

A F61 atualiza o auditor independente para o commit imutável `4fc18028256308bce60804d94699da3c64123cf1` (Imagine SEO Engine RC13). A CI deve validar **a mesma versão** da comparação, sitemap, canonicals, links, acessibilidade e qualidade de build. Consulte [PR #79](https://github.com/rafhael100/imagine-comercial/pull/79) e [PR #80](https://github.com/rafhael100/imagine-comercial/pull/80).

Nenhuma mudança implica publicação: a branch de integração continua em [PR #38](https://github.com/rafhael100/imagine-comercial/pull/38), `main` sem alteração. A autorização de VPS, Portal/CRM, GSC, ofertas, privacidade, dados e deploy continua em revisão.

## Orientação pública de contratação — F64 e F65 (10/11/2026)

A branch de integração em revisão [PR #38](https://github.com/rafhael100/imagine-comercial/pull/38) agora inclui dois recursos adicionais, ambos **HTML estático e sem coleta de dados**:

- [F64 /como-funciona/](https://github.com/rafhael100/imagine-comercial/pull/84): seis etapas ilustrativas e seis perguntas para organizar um briefing antes de conversar com a Imagine. Links na homepage, rodapé e Contato. Etapas, prazos, revisões, preços e responsabilidades dependem de contrato e proposta oficial.
- [F65 /perguntas-frequentes/](https://github.com/rafhael100/imagine-comercial/pull/86): quatro grupos com oito respostas sobre escopo, materiais, condições, mídia, resultados, Portal e proteção de credenciais. HTML `details` nativo, com navegação sem JavaScript, ligado ao rodapé, processo e Contato.

As duas rotas compõem o catálogo para canonical, sitemap, auditor SEO RC13 e QA com Playwright/axe em mobile e desktop; não criam formulário, histórico comercial, preços, consentimento, login, analytics, dados pessoais ou requisições para CRM/Portal.

**Não publicadas:** a `main` segue intacta. Aprovações de marca, conteúdo, propostas, canais, privacidade, VPS e infraestrutura Portal/CRM, GSC/301 e publicação real continuam nos [issues #56](https://github.com/rafhael100/imagine-comercial/issues/56), [#4](https://github.com/rafhael100/imagine-comercial/issues/4) e [#3](https://github.com/rafhael100/imagine-comercial/issues/3).

## Migração SEO: leitura GSC privada, sem redirecionamentos (10/11/2026)

Foi confirmada, pelo conector OpenSEO autorizado, a leitura **somente de páginas** do Search Console da propriedade pública `https://www.imaginecomunicacao.com.br/`. Isso avança o inventário, mas não comprova crawl completo, backlinks, equivalência, regra 301 ou publicação.

- **F66 [PR #88](https://github.com/rafhael100/imagine-comercial/pull/88):** auditor independente Imagine SEO RC15 pinado por SHA sobre F0–F65 atual, sem mesclar o ensaio divergente #85.
- **F67 [PR #90](https://github.com/rafhael100/imagine-comercial/pull/90):** oito caminhos legados adicionais foram classificados como **HOLD sem destino** (recrutamento, componente de contato e serviços em inglês). Mantém cinco candidatos apenas na simulação. A expectativa do teste Workerd foi corrigida em [PR #92](https://github.com/rafhael100/imagine-comercial/pull/92), comprovando todos os caminhos HOLD em 404/noindex na execução local.
- **F68 [PR #93](https://github.com/rafhael100/imagine-comercial/pull/93):** leitor offline de Search Analytics JSON com dimensão `page` e propriedade exata, descartando desempenho, CTR, consultas e tokens de URLs antes do relatório; o CLI recusa execução em GitHub Actions.

**Proteção de dados:** nenhuma métrica, pesquisa ou exportação verdadeira do GSC deve ser commitada ou adicionada a issues, logs ou artefatos de CI público. Evidências privadas permanecem no operador autorizado. O [issue de migração #3](https://github.com/rafhael100/imagine-comercial/issues/3) segue em HOLD até crawl e revisão 1:1, e [#56](https://github.com/rafhael100/imagine-comercial/issues/56) continua impedindo deployment, DNS e merge de produção.
