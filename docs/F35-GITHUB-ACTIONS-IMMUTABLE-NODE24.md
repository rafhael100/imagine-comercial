# F35 — Fortalecimento da cadeia de suprimentos do CI (Node 24 / SHA fixo)

Data: 09/11/2026. **Somente GitHub Actions de testes e revisão; sem publicação.**

## Motivação

Os workflows do Imagine Comercial ainda chamavam `actions/checkout@v4`, `actions/setup-node@v4` e `actions/upload-artifact@v4`. Logs do GitHub Actions registravam o aviso de depreciação do runtime Node 20 dessas ações, que o GitHub estava forçando a executar em Node 24. Além disso, `@v4` é uma tag móvel: o código da ação pode ser atualizado sem alterar o arquivo YAML.

## Contrato de ações revisadas

As três ações oficiais foram consultadas por meio do GitHub API na tag v7 e fixadas pelos SHAs completos observados:

| Ação | SHA fixado de revisão | Runtime da ação |
| --- | --- | --- |
| `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | Node 24 |
| `actions/setup-node` | `949feb2413d6458794dcd2491c4babbbce0c15c1` | Node 24 |
| `actions/upload-artifact` | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | Node 24 |

**Importante:** o runtime *das ações* muda para Node 24, mas o compilador e os testes Astro continuam executando em **Node 22**, conforme `node-version: '22'` e o projeto existente. Não foi alterado pacote npm, Astro, Playwright nem versão do SEO Engine.

Os arquivos de CI alterados são:
- `.github/workflows/validate.yml`
- `.github/workflows/commercial-cloudflare-migration-lab.yml`
- `.github/workflows/commercial-lighthouse-lab.yml`

Mantidos `permissions: contents: read`, todos os `checkout` com `persist-credentials: false`, `pull_request` em vez de `pull_request_target`, auditor SEO pinado em `238acb0772dc7597f23ce3fd1761d68be1d35179`, sem autenticação externa, sem cloud deploy e sem chaves de produção.

## Regressão

O teste `tests/ci-immutable-actions.test.mjs` falha se uma ação:
- usar referência por tag móvel ou SHA abreviado;
- tiver repositório/commit diferente da lista revisada;
- habilitar trigger privilegiado para conteúdo não confiável;
- solicitar `id-token: write` ou deixar de usar `contents: read`;
- abandonar Node 22 no runtime da aplicação;
- remover o pin do SEO Engine ou deixar token de checkout persistido.

A migração para v7 exige runners com versão compatível (checkout v7 requer runner moderno). O CI `ubuntu-24.04` hospedado no GitHub deve ser testado com todas as três pipelines. Se uma das ações falhar, a conclusão é **bloquear a promoção do PR e investigar**, não desabilitar os testes.

## Limites

Pinar SHAs reduz risco de mudança silenciosa em dependência de ações, **não garante que o código fixado seja seguro**; atualizações futuras exigem revisão de segurança, verificação do tag/commit e reexecução dos testes. Não é autorização de merge, release, Cloudflare, DNS, custeio, dados reais ou implantação.

Esta fase não instala serviços extras e não altera qualquer recurso de produção. A cobertura GSC/crawl real e a integração Portal/CRM/VPS continuam pendentes.
