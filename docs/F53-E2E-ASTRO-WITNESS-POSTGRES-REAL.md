# F53 — Cadeia Astro assinado → witness Ed25519 → PostgreSQL REAL, no CI

O job F51 inicia PostgreSQL 16 real, estritamente no runner descartável do GitHub. O F52 já exercita política/recibo com concorrência no banco. F53 acrescenta ao mesmo job o **build Astro real** e o ensaio completo `scripts/test-build-catalog.mjs`, com:

1. Catálogo de teste assinado e compilado como páginas HTML Astro;
2. Conferência F38 de bytes do build, releaseId, alvo e árvore SHA-256;
3. Verificação F45 da assinatura da política de confiança e do recibo do witness;
4. Comparação F40 de identidade de pacote e recibo;
5. Reserva anti-replay F41 via adaptador F49 e **PostgreSQL real** em sessões locais `psql`;
6. Rejeição de adulteração do HTML, assinatura falsa, política revogada, versão obsoleta, hash diferente e recibo repetido **sem** efetuar publicação.

O mesmo teste F50 continua usando o cliente simulado no CI habitual, para não depender de banco nem de credenciais. Somente a variável de teste `IMAGINE_EPHEMERAL_PG_TEST=1` em runner GitHub hospedado habilita o caminho PostgreSQL. O shim psql é exclusivamente de teste, não é cliente de aplicação nem recebe dados pessoais.

**Limites inalterados:** nenhum site foi entregue a servidor de hospedagem e nenhum witness externo atestou bytes publicados; o SHA do teste vem do pacote sintético. A VPS real, autenticação/grants/MFA, chaves operacionais, retenção/backup, Search Console, redação jurídica e aprovação de produção seguem no [issue #56](https://github.com/rafhael100/imagine-comercial/issues/56). Nenhum merge em main, DNS, deploy ou gasto nesta etapa.
