# F307 — Paridade cumulativa Portal PHP → Comercial Astro

## Objetivo

Comprovar que o **emissor de catálogo Ed25519 em PHP do Imagine Portal** e o **consumidor/compilador protegido em Node/Astro do Imagine Comercial** conseguem interpretar exatamente as mesmas três publicações: um checkpoint completo de seis serviços, uma alteração parcial de Landing Pages e outra alteração parcial de Onepage.

A verificação anterior F306 usava apenas o emissor de testes Node. A F307 exercita agora a **classe PHP real do contrato do Portal**, sem chamar API, banco ou serviço de produção.

## Proveniência fixada do emissor

O workflow da Imagine Comercial faz checkout de `rafhael100/imagine-portal` no commit imutável **`fc67d01747f53bc2f49a54769611a0397ebde5a1`**, correspondente ao contrato de laboratório do [Portal PR #119](https://github.com/rafhael100/imagine-portal/pull/119). Apenas a classe `apps/portal/app/Domain/CommercialPublishing/PublicCatalogSigner.php` é consumida pelo ensaio. Toda atualização dessa dependência deve ser deliberadamente revisada e pinada de novo.

O GitHub Actions exige PHP com extensões `sodium` e `mbstring`. Nada instala nova integração externa, abre acesso remoto ou acrescenta uma chave privada permanente ao repositório.

## Caminho efetivamente executado no CI

1. `scripts/test-portal-php-cumulative-build-ci.mjs` prepara um pacote JSON com seis serviços inteiramente fictícios, versões e duas revisões posteriores.
2. `scripts/emit-portal-php-cumulative-fixture.php` invoca `PublicCatalogSigner::sign` **três vezes** com uma chave Ed25519 efêmera guardada só na memória; exporta envelopes e chave **pública** para diretório temporário privado.
3. O Comercial valida as três assinaturas e seus pins, reconstruindo o catálogo cumulativo F305/F306 e exigindo último envelope igual ao release selecionado.
4. O próprio `scripts/build-protected-release.mjs` compila Astro usando a cadeia SHA-pinnada: verifica título/descrição de todas as seis páginas e preserva as duas revisões parciais.
5. `scripts/verify-protected-package.mjs` faz segunda conferência offline do mesmo pacote contra pins. Um SHA-256 histórico adulterado deve falhar.
6. O teste apaga temporários e restaura a compilação pública editorial normal para os demais testes SEO e navegador.

As provas são apenas do **contrato criptográfico e dos bytes HTML no GitHub Actions**, sem dados de cliente nem execução da VPS.

## Limites

O PHP usado é uma versão pinada do contrato de laboratório, **não** a instância autenticada do Portal em operação. Ainda faltam: autorizar editorial/tenant e MFA reais; provar ledger completo e sem lacunas a partir de fonte independente; governança e revogação de chaves; publisher durável; ativação de staging privado; AppSec/DBA/LGPD; aprovação de publicação e paridade GSC/URLs legadas.

**Status: DEV / revisão sintética, NO-GO.** PR #155 continua DRAFT. Sem merge `main`, dinheiro, 301, dados pessoais, DNS ou deploy.
