# Imagine Comercial — candidato F0–F32 para revisão técnica

Data: 09/11/2026. Esta branch é uma **consolidação de revisão**, não uma solicitação de publicação. Mantém as decisões e gates detalhados no documento `INTEGRACAO-P0-F30-REVIEW-2026-11-09.md`.

## Código incluído

- **F0–F25:** site Astro 7 com 15 rotas públicas; serviços, guias, SEO, canal de contato e QA de navegador; catálogo Portal Ed25519 **sintético**, release/hash pinados e build assinadamente obrigatório quando exigido.
- **F26–F28:** importação offline de GSC, comparação com crawler, HOLD de URLs/variantes, 301 somente simulados em Workerd; quatro cabeçalhos candidatos testados apenas na cópia temporária de build.
- **F29:** atalho HTTPS de login do Portal restrito a hosts exatos, sem login real ou tokens.
- **F30:** esquema de lead e idempotência **apenas em memória de laboratório**, sem API/captação.
- **F31:** testes contra requisições externas, cookies, armazenamento local, POST e import acidental do mock no site público.
- **F32:** auditoria de todos os links renderizados pelo Chromium nas 15 páginas públicas e 404: rotas exatas, hashes válidos, contatos externos limitados a canais existentes, prevenção de query, traversal e link hijacking.

## Evidência preliminar já verificada

- [F31 build/QA #42680057929](https://github.com/rafhael100/imagine-comercial/actions/runs/42680057929): 138/138 testes Comercial e 35/35 SEO.
- [F32 build/QA #42689291947](https://github.com/rafhael100/imagine-comercial/actions/runs/42689291947): **147/147** testes Comercial, **35/35** SEO e browser mobile/desktop com os links revisados. O teste foi corrigido para preservar o link de acessibilidade da 404 sem incluir a página no sitemap.
- [F0–F30 Workerd #42679033209](https://github.com/rafhael100/imagine-comercial/actions/runs/42679033209): 15 HTTP 200, 11 HTTP 404, 5 redirects **simulados**, quatro headers somente em loopback.
- [F0–F30 Lighthouse #42679033372](https://github.com/rafhael100/imagine-comercial/actions/runs/42679033372): scores locais 100/100/100 em homepage e Landing Pages. Não são Core Web Vitals de campo.
- **CI deste candidato F0–F32 precisa passar na própria branch**; os resultados antigos não substituem revalidação de integração.

## Bloqueios reais que impedem declarar finalização produtiva

1. **VPS de homologação Leaseweb** acessível e configurada com credenciais de serviço seguras, isolamento de projetos e monitoramento; a VPS paga ainda não está disponível para o fluxo desta revisão.
2. **Autenticação e CMS do Portal reais**, MFA, autorização por organização, aprovação editorial de catálogo, serviços mínimos com credenciais segregadas, assinatura de destino operacional e prova anti-rollback externa.
3. **CRM real:** API com autenticação, verificação de consentimento e finalidade, rate limiting, antifraude, auditoria, idempotência durável, fila, retenção/exclusão, política de privacidade versionada; o protótipo F30 não serve como integração.
4. **SEO legado:** Search Console real exportado em ambiente privado, crawl e backlinks, inventário e equivalência URL a URL, tratamento de idiomas/portfólio/termos e 301 aprovados um a um.
5. **Comercial/jurídico:** preços e planos vigentes, checkout oficial, identidade visual, contatos confirmados, licenças/portfólio e políticas/contratos.
6. **Staging protegido e produção:** testes de destino, segurança, backup/restauração, Core Web Vitals medidos, gates de liberação humana para merge na `main`, DNS, Cloudflare, headers e redirects.

A construção e o CI local podem continuar sem acesso à VPS; **o lançamento não**. Este documento não autoriza gastos, chaves, PII real, mudanças de DNS, deploy nem merge.
