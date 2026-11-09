# STATUS-ATUAL — Imagine Comercial
Data de referência: 09/11/2026, horário de Brasília.

## Decisão
Astro 7 SEO-first; projeto independente do Portal e do SEO Engine. Site atual `imaginecomunicacao.com.br` NÃO substituído.

## PRs de desenvolvimento
- PR #1 F0: fundação Astro — https://github.com/rafhael100/imagine-comercial/pull/1
- PR #2 F1: seis páginas de serviço, homepage e contato — https://github.com/rafhael100/imagine-comercial/pull/2
- PR #5 F2: contrato offline de conteúdo público e auditor de SEO fixado no CI — https://github.com/rafhael100/imagine-comercial/pull/5
- PR #6 F3: inventário parcial legado e redirecionamentos **não ativos** — https://github.com/rafhael100/imagine-comercial/pull/6
- PR #7 F4/F5: quatro artigos, hub editorial, guardas de versionamento — https://github.com/rafhael100/imagine-comercial/pull/7

## Validação mais recente
- Última execução aprovada antes da atualização documental: https://github.com/rafhael100/imagine-comercial/actions/runs/42559456590
- 35/35 testes Node aprovados; build Astro passou.
- 15 páginas HTML geradas, sitemap e robots verificados.
- Auditor independente SEO Engine: 15 páginas, **0 erros**, **0 avisos** relativos às regras implementadas.
- Não houve teste de Search Console real, browser, CWV de campo, CAPTCHA, lead CRM, pagamento ou fiscal.

## Gates
- Branches e PRs em draft; nenhuma main alterada por estes recortes, sem deploy ou modificação de DNS/produção.
- Portal CMS/checkout e conexão real com SEO Engine ainda não habilitados.
- Conteúdo editorial e dados de contato requerem revisão final antes da publicação.
- O domínio legado tem páginas `www`, `.html`, `en-us` e clientes; inventário/redirects completos exigem Google Search Console e revisão de conteúdo.
- `package-lock.json` ainda pendente; CI usa `npm install`, não build completamente reprodutível.

## Próximo recorte recomendado
Auditoria SEO da migração e estabilização de dependências/preview protegido, seguida de contrato de publicação autenticada com Portal e QA responsivo.

## Rodada F6/F7 — 09/11/2026
- PR #8: https://github.com/rafhael100/imagine-comercial/pull/8 — package-lock gerado, npm ci reproduzível, Chromium 24.04, axe WCAG 2.1 A/AA, capturas de browser.
- PR #9: https://github.com/rafhael100/imagine-comercial/pull/9 — hero comercial ilustrado em HTML/CSS, CTA primário de proposta, seis serviços com links da homepage.
- CI real mais recente: https://github.com/rafhael100/imagine-comercial/actions/runs/42565153025 — 37/37 testes Node passaram, 15 páginas HTML auditadas com 0 erros e 0 avisos no auditor offline, 15 rotas móveis e 6 desktop carregadas, testes axe WCAG nas páginas selecionadas sem violações detectadas. Capturas de mobile e desktop anexadas ao workflow.
- A versão ensaiada é estática e não publicada. Sem dados reais de tráfego, benchmark Google Lighthouse/CWV de campo, cadastro, carrinho, CMS real ou checkout financeiro homologados.
- Bloqueios seguintes: autenticação/autorização do publicador Portal, APIs e preços oficiais, URLs atuais completas e migração 301, revisão visual e conteúdo real com identidade oficial, privacidade e mensuração com consentimento, staging protegido, testes financeiros/fiscais e autorização de produção.
- CI temporário de geração de package-lock foi **removido** após registrar lock em branch. Não conceder auto-merge de PRs draft.

## Marco F8 — 09/11/2026
- PR #10: https://github.com/rafhael100/imagine-comercial/pull/10 — verificador Ed25519 offline dos snapshots públicos do catálogo do Portal, com chave pública autorizada e chaves de teste descartáveis. Não faz autenticação editorial nem deploy.
- Execução CI verificada: https://github.com/rafhael100/imagine-comercial/actions/runs/42565543554 — 44/44 testes Node aprovados, compilação Astro aprovada, auditor SEO independente sem erros, QA Chromium em 15 rotas mobile + 6 desktop, axe WCAG 2.1 A/AA nas rotas selecionadas.
- O site de produção permanece inalterado; nenhum pagamento, API CMS real, Search Console/GA4, DNS ou acesso financeiro ativado. Não alegar que este PR habilitou checkout ou indexação real.
- F6/F7 possuem capturas visuais de homepage e Landing Page no GitHub Actions; o design é preliminar, aguardando revisão da identidade visual real, conteúdo comercial e condições oficiais.
- Próximos gates críticos: publicação transacional autenticada e aprovada do Portal; inventário SEO completo; revisão de políticas/consentimento, ofertas, checkout, pagamentos e NFS-e antes de eventual produção.

## Rodada F9–F13 — 09/11/2026
- F9 PR #11: compilação Astro consome títulos, descrições e resumos de catálogo público assinado (dados de teste), com falha fechada para assinatura adulterada. CI: 51/51 testes.
- F10 PR #12: contato contextual por serviço, WhasApp/e-mail, sem envio de leads ao Portal. CI: 54/54 testes.
- F11 PR #13: página de erro HTTP 404 verdadeira, noindex e fora do sitemap. CI: 58/58 testes.
- F12 PR #14: orçamentos de peso de HTML, JavaScript, CSS e imagens; build, QA e auditor SEO aprovados. Referência: https://github.com/rafhael100/imagine-comercial/actions/runs/42576141045
- F13 PR #15: atualização do inventário de URLs públicas e preservação dos termos/privacidade legados (hold), sem regras 301 aplicadas.
- Toda a pilha permanece em PRs de rascunho e branches de desenvolvimento, com **main, domínio, DNS e produção preservados**.
- O CMS do Portal ainda NÃO publica dados reais; não há checkout, formulário CRM, rastreamento real, licença de imagens/portfólio homologadas ou política de privacidade migrada.
- Para lançamento continuam necessários inventário real de URLs e Search Console, fluxo do Portal autenticado/autorizações, homologação legal/fiscal/comercial, staging protegido e aprovação exclusiva para deploy/DNS.


## Consolidação P0 — Integração Comercial/SEO atualizada (09/11/2026)
Este bloco é o retrato atual e **substitui os números históricos das seções anteriores**; os relatos antigos permanecem para rastreabilidade.

- **Tecnologia:** Astro 7 estático por padrão. Repositório de aquisição pública independente do Portal e do SEO Engine.
- **PRs:** F0/F1/F2–F19 em rascunho, encadeados por base; última ponta [PR #19](https://github.com/rafhael100/imagine-comercial/pull/19). A `main` contém somente a fundação documental; **não declarar o site integrado/lançado**.
- **Motor SEO P1:** checkout em SHA fixo `238acb0772dc7597f23ce3fd1761d68be1d35179` (SEO-F5), e o CI do site executa também os testes do próprio motor, não apenas sua auditoria HTML.
- **Evidências integradas:** [CI Comercial + SEO](https://github.com/rafhael100/imagine-comercial/actions/runs/42620760030) — **78/78 testes do site e 35/35 do SEO Engine**, build Astro, auditor SEO e QA Chromium (15 rotas mobile e 6 desktop) aprovados; [Workerd local](https://github.com/rafhael100/imagine-comercial/actions/runs/42620759992) aprovado. São execuções de laboratório, não testes reais de produção.
- **Performance:** Lighthouse mobile local de homepage e Landing Pages teve 100 em desempenho, acessibilidade e SEO na [rodada validada](https://github.com/rafhael100/imagine-comercial/actions/runs/42583567496), sem garantia de CrUX/CWV de campo ou ranking.
- **Migração:** inventário parcial de **5 candidatas e 10 HOLD**, incluindo oito URLs de serviços antigas adicionadas em F19. Apenas simulação de 5 respostas 301, 2 páginas 200 e 11 respostas 404 no Workerd local; **nenhum `_redirects` real**.
- **Compatibilidade com Portal:** a [integração laboratório PHP→PostgreSQL→Astro](https://github.com/rafhael100/imagine-portal/actions/runs/42621077771) consumiu commit do site `365a6be1ac2a16f9eb39522ceb0c308e05f75302`, com 78 testes comerciais e 35 testes SEO aprovados; nenhuma autenticação/conta real.
- **Gates de lançamento:** resolver autenticador Portal/MFA/grants frescos, fluxo transacional de publicação e confirmação de entrega, checkout e fiscal homologados, marca/oferta/privacidade/licenças, inventário Search Console e URLs/301 completos, staging protegido e aprovação exclusiva de deploy e DNS.
- **Autoridade:** sem merge em `main`, deploy Cloudflare/VPS, alteração DNS, dados reais de clientes ou fornecedores pagos sem aprovação específica.
