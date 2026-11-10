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


## Rodada F20 — 09/11/2026
- [PR #20](https://github.com/rafhael100/imagine-comercial/pull/20) — validação adicional de segurança de origem dos redirects legados. Um manifesto não pode sequestrar rotas já presentes em `sitePages`, `robots.txt`, `sitemap.xml`, `404.html` ou `/.well-known/`.
- Testes novos em `tests/redirect-source-safety.test.mjs` cobrem colisões inclusive em status HOLD/candidate, segmentos dot e regressão positiva. Detalhes em `docs/F20-PROTECAO-ROTAS-ATUAIS-SEO.md`.
- **Status de validação:** testes recém-submetidos; confirmar resultado do CI do PR #20 antes de afirmar aprovação. Nenhuma regra 301 real foi escrita, nenhum merge em `main`, publicação ou alteração do domínio.
- Gates pendentes mantidos: inventário completo GSC, revisão jurídica/editorial, autenticação/MFA e autorização transacional do Portal, staging e aprovação exclusiva da publicação.


## Rodada F21 — 09/11/2026
- [PR #21](https://github.com/rafhael100/imagine-comercial/pull/21): validação 1:1 de canonical, `og:url`, `robots` e sitemap do HTML Astro gerado, evitando divergência de rotas, URLs extras, duplicação de canonical e `noindex` inadvertido.
- Testes de contrato com fixtures sintéticos: `tests/seo-output-contract.test.mjs`; verificador real: `scripts/verify-dist.mjs`; documentação: `docs/F21-INTEGRIDADE-CANONICAL-SITEMAP.md`.
- F20 CI corrigido e **aprovado**: https://github.com/rafhael100/imagine-comercial/actions/runs/42628077878.
- **CI de F21 aprovado**: https://github.com/rafhael100/imagine-comercial/actions/runs/42628813778 — Node, Astro build, verificação 1:1 do sitemap, auditor SEO Engine, catálogo assinado e QA em navegador. A validação não comprova resultados do Google em campo.
- **Nenhum merge em main, staging público, release, redirect 301 efetivo, DNS ou publicação**. Gate de revisão humana e integração Portal permanecem pendentes.


## Rodada F22 — 09/11/2026
- [PR #22](https://github.com/rafhael100/imagine-comercial/pull/22): inventário determinístico SHA-256 e manifesto **REVIEW-ONLY** do build estático, sem criar pacote de deploy. Bloqueia arquivos não homologados, regras Cloudflare, symlinks e HTML inesperado.
- [CI F22 aprovado](https://github.com/rafhael100/imagine-comercial/actions/runs/42630059498): 91/91 testes Comercial, 35/35 SEO Engine, build Astro e navegador aprovados. Inventário de 19 arquivos e 15 HTML públicos, total de 162905 bytes; digest de laboratório SHA-256 `1d822d1eb32106b4914e8563739784db5009b0a25f03ba72d7bb07db2f04dced`. Artefato de revisão com retenção de sete dias.
- O digest **não é assinatura do publicador**, não garante procedência e não constitui autorização de publicação.

## Rodada F23 — 09/11/2026
- [PR #23](https://github.com/rafhael100/imagine-comercial/pull/23): expansão do teste HTTP em Cloudflare Workerd **somente local** para todas as 15 rotas públicas, com metadados canônicos/robots/OG e arquivos sitemap.xml/robots.txt.
- [CI Workerd F23 aprovado](https://github.com/rafhael100/imagine-comercial/actions/runs/42630522286): 5 respostas 301 de candidatos ativados apenas numa cópia descartável, 15 respostas HTTP 200, 2 arquivos SEO e 11 respostas 404 com noindex e sem canonical.
- [CI geral F23 aprovado](https://github.com/rafhael100/imagine-comercial/actions/runs/42630522268): testes Node, build Astro, integração com SEO Engine e QA Chromium.
- Encadeamento atual até F23 em **PRs draft**. Nenhum merge em main, mudança de domínio, redirect ativo, deploy ou gasto com fornecedor.
- Gates de lançamento: aprovação editorial e jurídica, inventário integral GSC/301, marca/portfólio/licenças, CMS Portal com AuthN/AuthZ e MFA efetivos, operação transacional e recuperação, checkout/fiscal, staging privado e autorização expressa de DNS/produção.


## Rodada F24 — 09/11/2026

- [PR Comercial #24](https://github.com/rafhael100/imagine-comercial/pull/24): verificação de lote Ed25519 assinado, pins de releaseId e SHA-256, catálogo editorial permitido, metadados e resumo **no HTML Astro gerado**, com digest da árvore SHA-256 de arquivos F22. Somente laboratório, sem chave privada no repositório.
- [CI Comercial F24 aprovado](https://github.com/rafhael100/imagine-comercial/actions/runs/42644178104): **96/96 testes Node Comercial**, **35/35 SEO Engine**, build Astro, prova negativa de assinatura adulterada, versão/hash incorretos e título/HTML alterado, além do QA.
- [PR Portal #151](https://github.com/rafhael100/imagine-portal/pull/151): verificação cruzada **PHP signer → PostgreSQL de laboratório → Astro Comercial F24**, com commit do Comercial pinado em `9f36f770e8b19b37f9f5ac44ed84f5ae88e3d022`.
- [CI Portal PHP→Astro F24 aprovado](https://github.com/rafhael100/imagine-portal/actions/runs/42644779243): paridade de catálogo e HTML, digest SHA-256 e rejeição de conteúdo adulterado; dados e chaves descartáveis. A prova não implica homologação de deploy ou autorização real.
- **Gates ainda abertos:** sessão/MFA/grants reais do Portal, aprovação editorial transacional, revogação e receipt de publicação no destino, chaves operacionais, homologação de staging, inventário GSC e redirects por URL, termos/portfólio/contratos/checkout/fiscal e aprovação humana para main, DNS e produção. Sem alterações produtivas ou fornecedores pagos.


## Rodada F25 — modo obrigatório para compilação assinada (09/11/2026)

- [Comercial PR #25](https://github.com/rafhael100/imagine-comercial/pull/25): `IMAGINE_CATALOG_REQUIRE_SIGNED=1` exige assinatura Ed25519, chave pública, keyId, releaseId e hash esperados **mesmo quando todos os cinco campos desaparecem**; falha fechada e não compila silenciosamente o catálogo editorial.
- [CI Comercial aprovado](https://github.com/rafhael100/imagine-comercial/actions/runs/42657373288): **99/99 testes Comercial** e **35/35 SEO Engine**, build Astro real, teste de recusa por configuração totalmente ausente, pin divergente e QA navegador.
- [Portal PR #153](https://github.com/rafhael100/imagine-portal/pull/153): integração cruzada PHP→PostgreSQL 18→Astro usando commit F25 fixado e indicador obrigatório. [CI cross-repo aprovado](https://github.com/rafhael100/imagine-portal/actions/runs/42657709386), incluindo recusa explícita de fallback, alteração de hash e verificação do HTML assinado.
- Este modo é apenas uma intenção fornecida por um pipeline externo de confiança: **não substitui** grants de uma identidade autenticada, MFA, permissão segregada no Portal, serviço de publicação protegido, antifraude/revogação durável ou recibo de entrega. Não foi construído publicador operacional.
- Código permanece empilhado em PRs draft, `main` e domínio produtivo inalterados; nenhum deploy ou contratação extra. Próximo trabalho concreto requer consolidar a cadeia de branches, ligar publicação operacional à autoridade real do Portal e homologar staging protegido antes de promover um release.


## Rodada F26–F28 — auditoria SEO privada e cabeçalhos Workerd local (09/11/2026)

- **F26** [PR #27](https://github.com/rafhael100/imagine-comercial/pull/27): importação local de CSV GSC para classificar URLs conhecidas, desconhecidas e em HOLD. Recusa hosts externos, query PII e dot-segments normalizados. [CI F26 aprovado — 113/113 Comercial + 35/35 SEO](https://github.com/rafhael100/imagine-comercial/actions/runs/42672195118). Somente dados sintéticos no GitHub Actions; nenhuma conta GSC foi acessada.
- **F27** [PR #28](https://github.com/rafhael100/imagine-comercial/pull/28): cruza exportações GSC e crawler, separa hosts, aponta 3xx/404/5xx, lacunas e correspondência de duas fontes. Não considera variantes com query suprimida equivalentes. [CI F27 aprovado — 121/121 + 35/35](https://github.com/rafhael100/imagine-comercial/actions/runs/42673115248). O único resultado de negócio é revisão, **zero 301 aprovados**.
- **F28** [PR #29](https://github.com/rafhael100/imagine-comercial/pull/29): perfil candidato de quatro cabeçalhos HTTP defensivos, gerado como `_headers` somente no diretório temporário do teste Workerd, nunca em `public/` ou `dist/`. [CI de contratos e navegador aprovado — 124/124 Comercial + 35/35 SEO](https://github.com/rafhael100/imagine-comercial/actions/runs/42673681872). A validação HTTP real do Workerd local ainda deve ser verificada no HEAD F28 separadamente.
- **Gates persistentes:** Search Console real e crawl com exportações privadas, equivalência editorial e jurídica URL a URL, staging protegido, checklist de identidade/privacidade/contratos, integração operacional Portal/CRM, MFA/grants de serviços, recibo remoto/rollback externo e aprovação exclusiva de merge/DNS/produção. **Não publicar nenhum redirect, header ou site somente por CI verde.**
- A branch `main` e o domínio produtivo continuam preservados. Os PRs são empilhados sobre a branch de integração draft #26, sem merge ou deploy.


## Rodada F29–F31 — login Portal, contrato de lead e ausência de coleta (09/11/2026)

- **F29** [PR #31](https://github.com/rafhael100/imagine-comercial/pull/31): `PUBLIC_PORTAL_LOGIN_URL` aceita apenas HTTPS em hosts oficiais exatos e nega credenciais/queries/fragmentos/host falso. Inexistente por padrão. [CI F29 #42678050336](https://github.com/rafhael100/imagine-comercial/actions/runs/42678050336) — **129/129 testes Comercial + 35/35 SEO**, navegador e Astro aprovados.
- **F30** [PR #32](https://github.com/rafhael100/imagine-comercial/pull/32): contrato de leads **SINTÉTICO E SEM REDE**, campos mínimos, consentimento obrigatório, validação de serviço e prevenção de duplicidade UUID em memória; não coleta dados reais. [CI F30 #42678737962](https://github.com/rafhael100/imagine-comercial/actions/runs/42678737962) — **136/136 Comercial + 35/35 SEO**, browser/axe aprovados. Dependência registrada em [CRM issue #35](https://github.com/rafhael100/imagine-crm/issues/35).
- **Integração F0–F30** [PR #33](https://github.com/rafhael100/imagine-comercial/pull/33): [CI geral #42679033130](https://github.com/rafhael100/imagine-comercial/actions/runs/42679033130), [Workerd #42679033209](https://github.com/rafhael100/imagine-comercial/actions/runs/42679033209) e [Lighthouse local #42679033372](https://github.com/rafhael100/imagine-comercial/actions/runs/42679033372) aprovados. Lighthouse em duas páginas retornou 100/100/100, NÃO representa experiência de campo.
- **F31** [PR #34](https://github.com/rafhael100/imagine-comercial/pull/34): guardas Node + Chromium impedem importação/acesso ao mock de lead, formulário, POST, cookies, armazenamento local e requisições externas enquanto não houver API e aviso de privacidade aprovados. [CI #42679446452](https://github.com/rafhael100/imagine-comercial/actions/runs/42679446452) — **138/138 Comercial + 35/35 SEO**, browser mobile/desktop aprovado.
- Nenhum CRM conectado, formulário ao vivo, deploy, DNS, merge na `main` ou despesa externa. Todos os gates de AuthN/MFA/grants, recibo remoto, GSC/crawl real, política/contratos/preços, staging VPS e autorização exclusiva de lançamento permanecem **ABERTOS**. O projeto **não está integralmente pronto para produção**.


## Rodada F32–F33 — integridade de links e configuração controlada do Portal (09/11/2026)

- **F32** [PR #35](https://github.com/rafhael100/imagine-comercial/pull/35): `src/lib/public-link-review.mjs` audita o DOM renderizado pelo Chromium para verificar links internos somente nas 15 URLs do sitemap, fragmentos válidos, seleção de serviço em `/contato/#slug`, WhatsApp/e-mail/telefone allowlisted e proteção de nova aba. A 404 aceita apenas o próprio skip-link de acessibilidade, sem virar página indexável. [CI F32 #42689291947](https://github.com/rafhael100/imagine-comercial/actions/runs/42689291947) — **147/147 Comercial + 35/35 SEO, navegador aprovado**.
- **Integração F0–F32** [PR #36](https://github.com/rafhael100/imagine-comercial/pull/36): [CI Astro/SEO/Chromium #42689734469](https://github.com/rafhael100/imagine-comercial/actions/runs/42689734469), [Workerd local #42689734707](https://github.com/rafhael100/imagine-comercial/actions/runs/42689734707) e [Lighthouse local #42689734662](https://github.com/rafhael100/imagine-comercial/actions/runs/42689734662) **aprovados**. Quatro cabeçalhos defensivos e cinco 301 foram validados apenas em laboratório. Lighthouse 100/100/100 em duas páginas não são métricas reais de campo.
- **F33** [PR #37](https://github.com/rafhael100/imagine-comercial/pull/37): exceção estrita na auditoria de links para um destino HTTPS do Portal **somente quando a URL exata foi validada por `resolvePortalLoginLink` e configurada em build**. Em qualquer outra situação o link fica oculto ou é rejeitado. [CI F33 #42690443110](https://github.com/rafhael100/imagine-comercial/actions/runs/42690443110) — **149/149 Comercial + 35/35 SEO, navegador aprovado**.
- **Situação real:** site comercial está tecnicamente funcional em build local e CI, mas publicação **não concluída**. Falta VPS Leaseweb acessível, login/MFA/grants reais no Portal, CRM API/consentimento persistido, GSC e crawler reais, política legal/comercial/contatos confirmados, staging seguro, recibo de destino/anti-rollback e autorização exclusiva para merge/DNS/Cloudflare. Continua SEM deploy, dados reais, pagamentos ou `main` modificada.


## Rodada F34–F35 — inventário legado e supply chain CI (09/11/2026)

- **F34** [PR #39](https://github.com/rafhael100/imagine-comercial/pull/39): observação somente pública dos 8 links do menu de serviços legados e conteúdo de Facebook/Instagram e Mercado Livre; Meta continua **candidate** e Mercado Livre **HOLD**, sem 301 liberado. [CI #42691968228](https://github.com/rafhael100/imagine-comercial/actions/runs/42691968228) — **152/152 Comercial, 35/35 SEO**, QA navegador aprovado. Não representa crawl autorizado, HTTP 200 ao vivo ou inventário GSC completo.
- **F35** [PR #40](https://github.com/rafhael100/imagine-comercial/pull/40): três workflows de CI atualizados de ações v4 por tag móvel para checkout/setup-node/upload-artifact **v7 pinadas em SHA completo**, consultado diretamente na GitHub API, runtime interno Node 24, enquanto Astro permanece em Node 22. Teste novo bloqueia ação não pinada, versão não revisada, triggers privilegiados e escrita no token. [CI geral #42699357424](https://github.com/rafhael100/imagine-comercial/actions/runs/42699357424): **154/154 testes Comercial e 35/35 SEO**, Chromium aprovado. [Workerd #42699357426](https://github.com/rafhael100/imagine-comercial/actions/runs/42699357426) passou 15 x HTTP 200, 11 x 404, cinco 301 **simulados** e quatro headers; [Lighthouse local #42699357115](https://github.com/rafhael100/imagine-comercial/actions/runs/42699357115) manteve scores 100/100/100 em duas páginas, sem serem CWV de campo.
- **Canais de contato:** leitura pública do site histórico em 09/11/2026 confirma números (85) 3032-9525 e (85) 9 9663-2689, email imagine@imaginecomunicacao.com.br e horário de 8–12/14–18 de segunda a sexta; coincidem com o protótipo. A confirmação operacional dos canais com o responsável antes de lançamento permanece necessária.
- **Release gate:** continua totalmente **ABERTO** até staging privado Leaseweb acessível e preparado, integração Portal/CRM com identidade real/MFA/grants/consentimento durável, publicador autorizado e recibo externo, Search Console/crawl/backlinks reais, políticas/preços/portfólio e aprovação exclusiva para merge/DNS/Cloudflare. PRs são revisão; nenhuma autorização de deploy, serviço pago, processamento de cliente ou alteração na `main`.


## Rodada F36 — catálogo único de canais públicos de contato (09/11/2026)

- [PR Comercial #41](https://github.com/rafhael100/imagine-comercial/pull/41): `src/data/contact-channels.mjs` torna e-mail, telefone e WhatsApp uma fonte única; a página de contato Astro (HTML e JS da seleção de serviço) e o auditor de links F32 referenciam o mesmo catálogo. Builders de URL limitam intenção de contato, tamanho e CR/LF, sem rede ou captura de visitante.
- Canais comparados ao site público legado: `imagine@imaginecomunicacao.com.br`, `+558530329525` e `5585996632689`; evidência pública documentada em `docs/F36-SINGLE-SOURCE-PUBLIC-CONTACTS.md`. **Confirmar a operação dos canais antes de lançar.**
- [CI F36 #42701263239](https://github.com/rafhael100/imagine-comercial/actions/runs/42701263239) aprovado: **159/159 testes Comercial + 35/35 SEO**, Astro, Chromium mobile/desktop, links e axe WCAG.
- Não há formulário público, dados pessoais, integração CRM, deploy, DNS ou alteração de `main`. Os gates de VPS/staging, Portal/MFA/grants, aprovação editorial/privacidade e auditoria SEO real permanecem abertos.


## Rodada F37 — alvo protegido e prova de build assinada (09/11/2026)

- [PR Comercial #42](https://github.com/rafhael100/imagine-comercial/pull/42): \`IMAGINE_RELEASE_TARGET\` define explicitamente \`review\`, \`staging\` ou \`production\`; os dois alvos protegidos exigem \`IMAGINE_CATALOG_REQUIRE_SIGNED=1\`, snapshot Ed25519, trusted keyId, releaseId e SHA-256 válidos. Não ocorre fallback editorial, e alvos ambíguos são rejeitados.
- \`npm run build:protected\` compila o Astro usando chave pública, envelope e pins verificados; recusa modo review, remove evidências e \`dist/\` antigos antes mesmo da validação, cria somente prova de HTML assinado ↔ árvore SHA-256 em \`artifacts/protected-build-review/\` fora do diretório publicável. Não há deploy, recibo externo, chave privada ou aprovação operacional.
- [CI F37 #42715227623 aprovado](https://github.com/rafhael100/imagine-comercial/actions/runs/42715227623): **165/165 testes Comercial + 35/35 SEO**, build Astro assinado sintético, testes negativos contra produção sem assinatura/flag e contra pacote obsoleto, Chromium 15 mobile + 6 desktop e axe WCAG. O comando protegido foi exercitado de fato em testes E2E, não somente funções unitárias.
- **Limite crítico:** o guard depende de o orquestrador de release declarar o target corretamente. O futuro pipeline produtivo deve impor o target de forma independente, identificar MFA/grants/assinatura de autoridade do Portal, exigir recibo remoto com proteção anti-rollback e aprovação humana. Todos os gates de VPS/staging, CRM/LGPD, GSC/crawl, políticas/preços/contratos e DNS/Cloudflare permanecem **ABERTOS**. Sem merge na \`main\`, custos, dados reais ou deploy.


## Rodada F38 — dupla verificação offline do pacote protegido (09/11/2026)

- [PR Comercial #43](https://github.com/rafhael100/imagine-comercial/pull/43): `npm run verify:protected` valida um pacote Astro compilado em etapa independente, exigindo `IMAGINE_EXPECTED_BUILD_TREE_SHA256` de um **canal confiável separado** e pins Ed25519/releaseId/hash. Relê a árvore inteira com limites e sem symlink, compara metadados/HTML com catálogo assinado e confronta o manifesto `REVIEW-ONLY` com o pacote real. Não promove nem publica.
- E2E com chaves fictícias verifica hash confiável válido e rejeita homepage alterada pós-build, manifesto manipulado, pin de release errado, hash de árvore incorreto e alvo `review`. Encontrado/corrigido problema de integração do nome da propriedade do relatório no CLI, preservando validação de esquema exato.
- [CI F38 #42719002974 aprovado](https://github.com/rafhael100/imagine-comercial/actions/runs/42719002974): **170/170 testes Comercial + 35/35 SEO**, build de catálogo assinado, verificação independente E2E, Chromium 15 mobile + 6 desktop, axe WCAG.
- **Atenção:** hash de árvore no mesmo pacote não é prova de procedência. A infraestrutura de staging/produção deverá fornecer pin autenticado por canal externo, identidade/MFA/grants do Portal, recibo remoto não retrocedível, acesso VPS autorizado, revisão de privacidade/contratos e SEO real. PR rascunho; `main`, DNS/Cloudflare, clientes e custos não alterados.

## Atualização consolidada F39–F50 — 10/11/2026
Este bloco é o registro cronologicamente mais recente. As datas, resultados e números históricos acima representam etapas anteriores e não devem ser apresentados como o estado atual da branch de integração.

- **GitHub:** [PR integrado #38](https://github.com/rafhael100/imagine-comercial/pull/38), branch `integration/comercial-p0-f33-review-2026-11-09`, ainda **draft/review only**. `main` e o site existente não foram alterados.
- **F39–F48:** recibos de witness Ed25519, raiz assinada com sequência mínima, janela de validade, anti-replay e correlação de prova de pacote Astro. O E2E gera build real mas com chaves e recibos temporários, sem testemunha pós-entrega remota.
- **F49:** [PR #55](https://github.com/rafhael100/imagine-comercial/pull/55). Adaptador PostgreSQL parametrizado, `ON CONFLICT DO NOTHING`, índice único via migração proposta e testes de falha/concorrência simulados. [CI individual](https://github.com/rafhael100/imagine-comercial/actions/runs/42752824184) aprovado. A migração não foi aplicada e nenhum PostgreSQL real foi testado.
- **F50:** [PR #57](https://github.com/rafhael100/imagine-comercial/pull/57). Exercita o adaptador PostgreSQL através do fluxo E2E de Astro assinado com um transporte SQL **simulado**. [CI individual](https://github.com/rafhael100/imagine-comercial/actions/runs/42753382431) aprovado; testes integrados do HEAD consolidado devem ser avaliados separadamente.
- **Bloqueio principal:** [issue #56](https://github.com/rafhael100/imagine-comercial/issues/56) (VPS Leaseweb, staging privado, DB real, witness remoto, IAM/MFA e verificação pós-entrega). [Issue #3](https://github.com/rafhael100/imagine-comercial/issues/3) migração/GSC real; [issue #4](https://github.com/rafhael100/imagine-comercial/issues/4) contrato CMS/Portal.
- **Demais dependências:** CRM e consentimento durável, revisão de identidade, contatos, ofertas/preços e documentos jurídicos, testes externos e autorização explícita de publicação.
- **Limites:** nenhum merge na `main`, DNS, deploy, migração real, serviço pago novo ou dados reais de clientes nesta rodada. O fato de uma verificação de CI passar não marca gates F42 como `reviewed`.

## Marco F51–F53 — banco real e build assinado, CI isolado (10/11/2026)

Este marco **substitui as afirmações históricas** de que todos os testes de PostgreSQL usam apenas driver simulado. A **VPS de produção/homologação continua sem validação**.

- [F51 PR #62](https://github.com/rafhael100/imagine-comercial/pull/62): PostgreSQL 16 **real** no runner GitHub Actions descartável; migração F49 aplicada só na nova base CI, testes de constraint UNIQUE, concorrência, replay e privilégio mínimo. [CI F51](https://github.com/rafhael100/imagine-comercial/actions/runs/42756220302) sucesso.
- [F52 PR #64](https://github.com/rafhael100/imagine-comercial/pull/64): recibos Ed25519 e política assinados atravessam PostgreSQL real com oito reservas concorrentes (apenas uma aceita); validações negativas. Falha inicial do teste foi corrigida; [CI F52 corrigido](https://github.com/rafhael100/imagine-comercial/actions/runs/42756721502) sucesso.
- [F53 PR #65](https://github.com/rafhael100/imagine-comercial/pull/65): build Astro real com catálogo de teste assinado, verificação criptográfica e reserva PostgreSQL verdadeira no mesmo fluxo. [CI PostgreSQL F53](https://github.com/rafhael100/imagine-comercial/actions/runs/42757138581) e [CI Astro F53](https://github.com/rafhael100/imagine-comercial/actions/runs/42757138551) sucesso.
- **Integração F0–F53 no commit `5e13cb578af6b0dbe4c01cd59b32cd47304a78fd`: quatro workflows aprovados:** [PostgreSQL real](https://github.com/rafhael100/imagine-comercial/actions/runs/42757296741), [Astro/SEO/navegador](https://github.com/rafhael100/imagine-comercial/actions/runs/42757296728), [Workerd](https://github.com/rafhael100/imagine-comercial/actions/runs/42757296707) e [Lighthouse local](https://github.com/rafhael100/imagine-comercial/actions/runs/42757296716).
- **Gates reais ainda abertos:** [Leaseweb/staging e witness pós-entrega #56](https://github.com/rafhael100/imagine-comercial/issues/56), [GSC/redirects/rotas legais #3](https://github.com/rafhael100/imagine-comercial/issues/3), [Portal autorizado/CMS #4](https://github.com/rafhael100/imagine-comercial/issues/4), CRM/consentimento, credenciais/roles, contratos, preços, conteúdo e aprovação explícita do responsável.
- **Limites inalterados:** branch integrada em PR draft, `main` apenas documental, nenhum deploy, mudança de DNS, banco da VPS alterado, dados reais de clientes ou despesa adicional nesta etapa.


## F56 — SEO RC10 auditado e fixado no GitHub (10/11/2026)
- Auditor da branch de integração atualizado para Imagine SEO Engine RC10, commit imutável `60738518c51df8a259ce56babb0e2f61682b1658` ([PR SEO #45](https://github.com/rafhael100/imagine-seo-engine/pull/45)), conforme o [ensaio Comercial #69](https://github.com/rafhael100/imagine-comercial/pull/69), sem merge de branches antigas.
- Executa `--fail-on-warnings --strict-public-head` e testes independentes antes do build Astro, verificando head real, canonical, robots, sitemap, Googlebot e links de corpo.
- O pin atualizado não consulta o Search Console real, não valida backlinks, não habilita 301, DNS ou publicação; a revisão de URLs históricas continua no issue #3. Integração F55 e tabelas PostgreSQL preservadas.

## Passagem F54–F57 — 10/11/2026

- **F54 [PR #67](https://github.com/rafhael100/imagine-comercial/pull/67):** política Ed25519 assinada com piso monotônico persistente testado em PostgreSQL real de CI, comparação de sequência/hash e reserva atômica de nonce; 4 workflows integrados aprovados.
- **F55 [PR #70](https://github.com/rafhael100/imagine-comercial/pull/70):** funções PostgreSQL SECURITY DEFINER e papel execute-only com testes reais de revogação, replay, concorrência e acesso negado às tabelas; CI individual e integração aprovados.
- **F56 [PR #71](https://github.com/rafhael100/imagine-comercial/pull/71):** atualização do auditor Imagine SEO Engine RC10 por SHA imutável, auditoria de head público estrita e avisos como falha; CI corrigido aprovado depois de ajustar teste de comando, sem mudar main.
- **F57:** reforço de negação de permissões SQL e documentação de requisitos de homologação. Testes integrados desta revisão devem ser conferidos separadamente.
- **Bloqueios reais:** [#56 Leaseweb e integração operacional](https://github.com/rafhael100/imagine-comercial/issues/56), [#3 GSC e redirects](https://github.com/rafhael100/imagine-comercial/issues/3), [#4 Portal CMS](https://github.com/rafhael100/imagine-comercial/issues/4), CRM/consentimento e autorização editorial/jurídica e de produção.
- **Sem** merge main, deploy, acesso à VPS, DNS, dados reais ou novas despesas.

## Ensaio SEO RC12 — revisão read-only e segura (10/11/2026)
- Só a branch de ensaio fixa o SEO Engine em `563a9f6b4155cecd3708b8a35b2ca4be68de4cc5` ([RC12 #49](https://github.com/rafhael100/imagine-seo-engine/pull/49)), sem trocar ações por refs móveis.
- Conserva `--fail-on-warnings --strict-public-head`, todas as verificações do Comercial P0, QA browser e PostgreSQL descartável.
- Revalida orçamentos de recursos F33 e bloqueio `robots=nofollow` F34 do SEO. Nenhum merge, deploy, OAuth, DNS ou dados reais de cliente.

## Marco F58–F59 — experiência comercial pública sem captação (10/11/2026)

Este marco é posterior aos registros F57/SEO RC12 acima; a evidência de CI local **não** autoriza release.

- **SEO RC12** no commit fixo `563a9f6b4155cecd3708b8a35b2ca4be68de4cc5`, ensaiado em [PR #74](https://github.com/rafhael100/imagine-comercial/pull/74) e integrado apenas à branch de revisão. Os quatro workflows da integração RC12 passaram no commit `12ef7291bc46f7a2ed511cbf2eb230976f209985`.
- **F58 [PR #75](https://github.com/rafhael100/imagine-comercial/pull/75):** orientador interativo de cinco objetivos para seis serviços, conteúdo estático e revisável, sem preço, login, API, envio de lead ou armazenamento. Testes Node e Playwright em mobile/desktop, WCAG axe e fallback sem JS. CI individual [Astro/SEO/navegador #42835648139](https://github.com/rafhael100/imagine-comercial/actions/runs/42835648139) success, e PostgreSQL descartável [#42835647815](https://github.com/rafhael100/imagine-comercial/actions/runs/42835647815) success.
- **F59 [PR #76](https://github.com/rafhael100/imagine-comercial/pull/76):** links “Conhecer” e “Solicitar proposta” por sugestão; segundo link usa somente `/contato/#slug` e reutiliza o contato já existente, sem transmissão automática. QA Playwright testa Landing Pages e Meta Ads do guia ao seletor. CI individual [Astro/SEO/navegador #42836484104](https://github.com/rafhael100/imagine-comercial/actions/runs/42836484104) success, PostgreSQL descartável [#42836484183](https://github.com/rafhael100/imagine-comercial/actions/runs/42836484183) success.
- **Branch review-only no PR #38:** HEAD acumulado `e75b239560bb484ea2a289a640230e637f92056a` (F0–F59). Os quatro workflows pós-integração devem ser considerados separadamente, no mesmo SHA; não usar testes de PR individual como prova de integração se houver mudança de HEAD.
- **Bloqueios de produção:** #56 VPS Leaseweb/Portal/CRM, #3 GSC/URLs/301, #4 CMS e aprovação de conteúdo, preços, contato, privacidade, segurança, acessibilidade real e autorização de publicação. **Nenhum** merge em `main`, DNS, deploy, dados reais de clientes ou novos custos nesta etapa.

## F60–F61 — comparação de soluções e auditoria SEO RC13 (10/11/2026)

- **F60 [PR #79](https://github.com/rafhael100/imagine-comercial/pull/79):** nova rota `/comparar-solucoes/`, editorial estático e seis cartões curados nos grupos presença/mídia. Links da home e do catálogo; `sitePages` e sitemap atualizados. QA Playwright mobile/desktop testa seis serviços, 18 critérios, 12 links, contato contextual, no overflow e WCAG axe; sem JS, tracking, PII, preço ou backend. [CI individual Astro/SEO/Chromium #42841983353](https://github.com/rafhael100/imagine-comercial/actions/runs/42841983353) e [PostgreSQL descartável #42841983633](https://github.com/rafhael100/imagine-comercial/actions/runs/42841983633) SUCCESS.
- **F61 [PR #80](https://github.com/rafhael100/imagine-comercial/pull/80):** auditor SEO Engine RC13 pinado na SHA `4fc18028256308bce60804d94699da3c64123cf1`, previamente validada em ensaio independente #77, mantendo `--fail-on-warnings --strict-public-head`. É necessária nova CI **da branch conjunta** para comprovar RC13 sobre a página F60; o ensaio #77 sozinho não prova esse cenário.
- **Operação:** site atual, `main` e DNS não sofreram alterações. Não foram contratados fornecedores nem usados dados pessoais reais. Gate de infraestrutura/vigilância operacional em #56; pesquisa de URLs/GSC/301 em #3, CMS Portal em #4. Conteúdo e condições comerciais continuam sujeitos a aprovação e homologação.

## Marco F64–F65 — onboarding editorial sem captação (10/11/2026)

- **F64 [PR #84](https://github.com/rafhael100/imagine-comercial/pull/84):** página `/como-funciona/` com seis etapas, roteiro de briefing, avisos sobre condições contratuais e não compartilhamento de credenciais. Links na home, Contato e rodapé, sitemap/canonical e QA de navegação em dispositivos móveis/desktop. CI individual [Astro/SEO/Chromium #42857991393](https://github.com/rafhael100/imagine-comercial/actions/runs/42857991393) e [PostgreSQL real descartável #42857991435](https://github.com/rafhael100/imagine-comercial/actions/runs/42857991435) **success**. CI integrado F0–F64: **4/4 success** no commit `360fe956958619e3dbb89e4d3d898703b9156cdc`.
- **F65 [PR #86](https://github.com/rafhael100/imagine-comercial/pull/86):** página `/perguntas-frequentes/` com quatro grupos e oito respostas sem cláusulas ou garantias não aprovadas; HTML details/summary sem JavaScript, links da página Como funciona, Contato e footer. CI individual [Astro/SEO/Chromium #42858926496](https://github.com/rafhael100/imagine-comercial/actions/runs/42858926496) e [PostgreSQL descartável #42858926743](https://github.com/rafhael100/imagine-comercial/actions/runs/42858926743) **success**.
- **F0–F65 integradas** até o commit `d3d0860f16403c16cc80080c80a7d98c0ff498d4`. Os quatro workflows do commit acumulado são verificados separadamente; não confundir com CI de PR individual. A branch permanece em [PR #38](https://github.com/rafhael100/imagine-comercial/pull/38), DRAFT/REVIEW ONLY.
- **Gates ainda abertos:** VPS Leaseweb/staging e witness remoto, grants/MFA/Portal, CRM/consentimento e dados operacionais, GSC/URLs legadas/301, revisões comercial/jurídica/editorial, segurança de campo e aprovação humana de publicação. `main`, produção, DNS, bancos persistentes e dados de clientes não foram alterados nesta rodada.

## RC16 revalidada na ponta Comercial P0 mais recente (10/11/2026)
- A base Comercial P0 avançou após o primeiro ensaio #89; novo PR exige CI sobre o commit-base `70b47ad50f417c7572f04fedbc7f7f58ae0e8929`, mantendo checkout SEO RC16 `20c8b572593cf26338268d8a736eeea91ca1d3f6` imutável.
- Mantém auditoria `--fail-on-warnings --strict-public-head`, testes Comercial, Astro, navegador e PostgreSQL efêmero.
- A revalidação evita usar CI de snapshot antigo como prova do estado corrente; não efetua deploy, merge main, OAuth, dados de cliente ou DNS.
