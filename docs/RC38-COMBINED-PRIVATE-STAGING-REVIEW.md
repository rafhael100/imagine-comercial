# RC38 — Compatibilização da homologação privada RC37 com Comercial RC33

## Implementação efetiva (somente DEV)

A configuração proposta em SEO RC37 foi **incorporada à base funcional** do Imagine Comercial, sem sobrepor contatos, catálogo e aprovações do orçamento P0.

- `ops/staging/compose.yaml` exige Nginx sem privilégios por digest SHA-256 revisado, mapeia **somente** `127.0.0.1:4321` e mantém filesystem read-only, volumes de leitura, `cap_drop: ALL`, `no-new-privileges` e limites de CPU/memória.
- `ops/staging/nginx.conf` agora inclui expressamente `X-Robots-Tag: noindex, nofollow, noarchive` **em qualquer status HTTP**, além de `Cache-Control: no-store`. Esses cabeçalhos são uma defesa adicional; **não** tornam seguro expor a porta diretamente na Internet.
- `scripts/check-private-staging-prerequisites.mjs` faz revisão offline de formato do digest e dos arquivos de build, sem Docker/SSH/deploy. Prova criptográfica da imagem **não** é validada por esse script.
- `src/lib/private-staging-http-gate.mjs` verifica 4 páginas públicas e **18 URLs legadas em HOLD** por GET em loopback, status, cabeçalhos F28, conteúdo e ausência de redirecionamentos. O laboratório Workerd executa a mesma verificação sobre HTTP real isolado.
- `scripts/browser-qa.mjs` foi atualizado **preservando todo o QA comercial/privado P0** para verificar também no Astro Preview real as **23 URLs legadas** (5 candidatas, 18 em HOLD), exigindo HTTP 404, ausência de redirect/canonical/dados estruturados e `noindex`.
- Testes Node sobre contrato Nginx, Compose, imagem e URLs; CI Workerd e navegador continuam executados em ambiente de CI.

## Próximos gates operacionais

1. **VPS Leaseweb liberada** administrativamente, sem copiar dados secretos para PR público; revisão de redes, HTTPS, identidade e MFA.
2. Validação independente de digest **real**, assinatura/proveniência e CVEs da imagem. Valor textual SHA-256 não comprova que uma imagem é confiável.
3. Teste do contêiner com artefato de build real e verificação de bind exclusivo localhost, `noindex` e erros; ação separada com autorização do operador. Nenhum contêiner foi iniciado nesta entrega.
4. Homologação autenticada Portal/CRM, tenant isolation, privacidade/LGPD, evidência F70 e aprovação de release.
5. Inventário de migração SEO/301 por URL, revisão editorial e rollback. Os redirects em Workerd permanecem **simulados em área descartável**.

A PR consolidada de `main` continua DRAFT. Sem merge de produção, alteração de DNS, segredos reais, contatos com clientes ou custo novo.
