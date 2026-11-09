# Imagine Comercial — Candidato de integração F0–F28 (REVIEW ONLY)

Referência: 09/11/2026. **Este documento não autoriza merge em main, deploy, troca de DNS ou redirecionamentos.**

## Código consolidado neste candidato
- Astro 7 com 15 páginas públicas indexáveis curadas, navegação/contato contextual, quatro artigos e rotas corretas 404.
- SEO Engine auditado em commit fixado; QA navegador, axe e Lighthouse local, orçamentos estáticos.
- Catálogo Portal sintético assinado Ed25519, pin de versão/hash, vínculo ao HTML compilado e falha fechada quando assinatura é obrigatória.
- Migração SEO legada somente em simulação Workerd: 5 candidatos 301 sintéticos e 10 HOLD, sem regras `_redirects` produtivas.
- F26: importação de CSV GSC com validação do domínio e supressão de query/fragmentos. Não há exportação real no CI.
- F27: confronta CSV GSC e crawl técnico, marca 301 antigos, 404, 5xx, divergências de host e páginas exclusivas; não concede aprovação de redirect.
- F28: perfil candidato de quatro cabeçalhos HTTP, inserido apenas em build temporário do Workerd local para testes de resposta, nunca no build/deploy definitivo.

## Evidências anteriores
- [F26: 113 testes Comercial e 35 SEO aprovados](https://github.com/rafhael100/imagine-comercial/actions/runs/42672195118).
- [F27: 121 testes Comercial e 35 SEO aprovados](https://github.com/rafhael100/imagine-comercial/actions/runs/42673115248).
- [F28: 124 testes Comercial e 35 SEO aprovados](https://github.com/rafhael100/imagine-comercial/actions/runs/42673681872).
- [Portal PHP→PostgreSQL→Astro F27: receipt assinado fictício + ACK local](https://github.com/rafhael100/imagine-portal/actions/runs/42667004769).
- A CI **desta branch consolidada** deverá revalidar tudo; resultados de branches anteriores não substituem sua verificação.
- Alguns runs recentes do GitHub Actions foram marcados failed sem iniciar jobs, sem logs de execução. Esses runs não comprovam defeito do código nem passam como testes verdes.

## Gates antes de lançamento — todos abertos
1. Autoridade real Portal: identidade, MFA, autorização editorial, organização, revogação e isolamento multiempresa.
2. Publicador operacional: serviço mínimo, assinatura de testemunha remota real, outbox/recibo idempotente, witness externo contra rollback, monitoramento e restauração.
3. Search Console real, crawler de todos os hosts/URLs, backlinks, migração de idioma/portfólio/termos e equivalência de cada redirect.
4. Revisão comercial e legal: identidade visual, conteúdo, provas/portfólio, política de privacidade e consentimento, planos/preços/checkout e fiscal oficiais.
5. Homologação privada com VPS e Cloudflare autorizados, testes ponta a ponta com credenciais verdadeiras e rollback.
6. Aprovação humana exclusiva para merge `main`, publicar em Cloudflare, alterar DNS e ativar 301/headers produtivos.

**Sem despesas novas, acesso remoto, credenciais, clientes reais, publicação ou auto-merge nesta etapa.** O código é candidato de revisão acumulada, não lançamento concluído.
