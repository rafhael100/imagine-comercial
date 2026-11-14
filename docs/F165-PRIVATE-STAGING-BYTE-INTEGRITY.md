# F165 — Staging privado exige SHA-256 exato dos bytes do build

## Mudança implementada

O pré-voo F164 anterior verificava principalmente referência da imagem e existência de `index.html`/`404.html`. Isso não bastava para detectar uma página ou JavaScript adulterado entre o build aprovado e o diretório compartilhado com o futuro contêiner.

Agora `src/lib/staging-build-integrity.mjs` percorre **todos** os arquivos do `dist` sem seguir symlinks, impede entradas especiais, arquivos inesperados e regras de deploy como `_headers`/`_redirects`, limita profundidade, quantidade e bytes, e reaproveita exatamente o algoritmo de manifesto SHA-256 da F22. A comparação exige a variável `IMAGINE_EXPECTED_STAGING_TREE_SHA256` com **64 dígitos hexadecimais em minúsculas**, recebida do operador por canal separado e aprovado. Um único byte divergente bloqueia o pré-voo.

O CLI existente `scripts/check-private-staging-prerequisites.mjs` agora exige tanto a imagem Nginx unprivileged referenciada por digest quanto o pin SHA-256 da árvore do site, com `IMAGINE_PRIVATE_STAGING_REVIEW=1`. O resultado continua **somente diagnóstico**; jamais devolve autorização de publicação.

## Testes

- A suíte Node usa um pacote de teste mínimo e cobre sucesso, byte alterado, asset omitido, HTML extra, symlink, regras de deploy e arquivos ocultos, imagem de input inválida e tamanho excessivo.
- A CI, depois de gerar seu próprio manifesto `REVIEW-ONLY`, executa o comparador sobre o Astro compilado **real** e faz uma cópia temporária na qual altera um byte de `index.html`; a alteração precisa ser rejeitada. É um teste de funcionalidade com hash calculado **pela própria CI**, não uma autenticação independente do emissor.
- Nenhuma rede, credencial, container, VPS, DNS, 301, lead ou dados reais participam do teste.

## Limite de confiança

Igualdade de SHA-256 **não comprova autoria ou aprovação** se o pin vier do mesmo pacote comprometido. Para uso em Leaseweb, o responsável precisa verificar por canal independente o SHA esperado, a assinatura/proveniência da imagem, política do release e o artefato transportado. IAM/MFA, TLS, isolamento, F70 e Portal/CRM operacional continuam bloqueios explícitos. A `main` e o domínio público permanecem inalterados.
