# Imagine Comercial — integração F0–F30, exclusivamente para revisão

Data: 09/11/2026. **Não publicar, não mesclar `main`, não alterar DNS.**

Esta branch consolida os PRs documentais e de código F0–F30 para revisão técnica acumulada, sem substituir as revisões de cada etapa nem promover o site público.

## Escopo acumulado
- Astro 7: homepage, catálogo com 6 serviços, área de conteúdo, contato WhatsApp/e-mail e 404; 15 URLs indexáveis.
- SEO Engine fixado por commit; auditoria, Lighthouse local e QA Chromium/WCAG, testes HTTP Workerd em loopback.
- Catálogo público assinado Ed25519 do Portal em laboratório, compilação obrigatoriamente assinada quando exigida, releaseId/digest e verificação de HTML gerado; nenhum publicador produtivo.
- Migração legado: 5 candidatos de redirect somente simulados; GSC/crawl sintéticos e comparador de URLs, HOLD de divergências, arquivos de produção sem `_redirects`.
- Cabeçalhos defensivos F28 somente na cópia temporária de Workerd, sem arquivo `_headers` do site.
- F29: validação restritiva e fail-closed de URL de login do Portal, oculto por padrão.
- F30: validação sintética de dados mínimos de lead, consentimento e inbox de idempotência apenas em memória; **sem formulário, endpoint ou CRM conectado**.

## Evidências
- [Integração F0–F28 build e QA](https://github.com/rafhael100/imagine-comercial/actions/runs/42674653378): 124/124 testes Comercial e 35/35 SEO aprovados.
- [Integração F0–F28 Workerd local](https://github.com/rafhael100/imagine-comercial/actions/runs/42674653628): 15 HTTP 200, 11 HTTP 404, 5 redirects simulados e 4 headers candidatos aprovados em runtime de laboratório.
- [Integração F0–F28 Lighthouse local](https://github.com/rafhael100/imagine-comercial/actions/runs/42674653481): baseline 100/100/100 em homepage e Landing Pages (não CWV de campo).
- [F29 link Portal QA](https://github.com/rafhael100/imagine-comercial/actions/runs/42678050336): 129/129 testes Comercial e 35/35 SEO aprovados.
- Testes de F30 e deste PR têm de ser verificados separadamente, após o CI desta branch.

## Gates abertos que impedem o lançamento
1. **Portal real:** identidade, MFA, grants, segregação entre empresas, revisão/aprovação editorial, chave operacional e revogação/backup de verdade.
2. **Publicador:** autorização de deploy, publicador de mínimo privilégio, recibo remoto independente, idempotência durável e prova fora do escopo de rollback da base.
3. **CRM/captação:** endpoint e antifraude reais, consentimento com aviso de privacidade aprovado e versionado, retenção e exclusão, testes ponta a ponta e métricas apenas com consentimento aplicável.
4. **SEO legado:** Search Console real, crawl completo, backlinks e equivalência editorial/legal URL a URL, aprovação exclusiva dos 301.
5. **Comercial e jurídico:** identidade visual oficial, ofertas/preços/planos, referências a clientes, políticas/contratos, checkout e questões fiscais.
6. **Infraestrutura:** VPS de homologação ainda precisa estar acessível; configurar ambiente protegido, logs, recuperação e testes reais de destino.
7. **Autorização de lançamento:** decisão separada e expressa para merge, DNS, Cloudflare, headers e redirects produtivos depois dos gates.

**A aprovação de testes sintéticos nunca equivale ao fechamento destes gates**. Não configurar tokens, serviços externos pagos, autenticação real, publicação, dados reais ou produto financeiro nesta branch.
