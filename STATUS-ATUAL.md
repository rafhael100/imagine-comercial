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
