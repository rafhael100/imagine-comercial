# F37 — Alvo de build protegido sem fallback editorial

Data: 09/11/2026. Revisão de código e testes, sem alteração em produção.

## Risco tratado

O F25 já exige um catálogo Ed25519 assinado e releaseId/hash pinados quando o orquestrador define `IMAGINE_CATALOG_REQUIRE_SIGNED=1`. Porém, um build destinado à homologação ou produção poderia deixar essa variável ausente e voltar ao catálogo editorial local, mesmo quando a intenção de implantação já estivesse definida fora do build.

O F37 introduz `IMAGINE_RELEASE_TARGET`, um sinal explícito e controlado pelo **pipeline de build**, com apenas três valores aceitos: `review`, `staging` ou `production`.

| Alvo | Comportamento do catálogo |
| --- | --- |
| Ausente ou `review` | Build editorial local permitido, sem autorização de deploy; F25 assinado obrigatório continua disponível por solicitação explícita |
| `staging` | Falha se `IMAGINE_CATALOG_REQUIRE_SIGNED` não for `1`, ou se não houver envelope, chave pública, keyId, releaseId e SHA-256 completos e verificados |
| `production` | Mesma falha fechada: sem fallback, sem configuração parcial, sem assinatura falsificada ou hash inesperado |

Valores como `prod`, `STAGING`, `true`, `0`, strings com espaços ou tipos não string são recusados. O build de revisão permanece sem acesso a credenciais e sem integração de clientes.

## Integração e testes

- `src/lib/build-release-target.mjs`: único contrato de alvos e intenção de assinatura, sem estado ou requisições externas.
- `src/lib/build-catalog.mjs`: chama o contrato antes de selecionar editorial ou snapshot assinado, exigindo modo assinado sempre que staging/production forem declarados.
- `tests/build-release-target.test.mjs`: revisão padrão, targets inválidos, produção sem assinatura, configuração parcial, limites explícitos.
- `tests/build-catalog.test.mjs`: testes com chaves Ed25519 descartáveis de um lote assinado, incluindo pins e hash adulterado para ambos os alvos protegidos.
- `scripts/test-build-catalog.mjs`: usa lote sintético assinado no build Astro com alvo `staging`, testa recusa de `staging` e `production` reais quando a flag ou catálogo obrigatório estiverem ausentes, restaura o build editorial somente para QA de revisão.

## Limitações de segurança

**Este guard é necessário, mas não suficiente para publicação.** Ele somente se aplica quando o orquestrador define o alvo de build corretamente; um publicador que omita `IMAGINE_RELEASE_TARGET` não deve ser considerado protegido por este contrato. A CI autorizada de deploy deverá exigir o alvo de forma independente, bloquear pacotes `review`, verificar autoridade do Portal (identidade, MFA, grants, revisão editorial), chave e assinatura operacional, releaseId pinado, prova externa de entrega, monitoramento, restauração e aprovações. Nunca usar valores do navegador, conteúdo de CMS ou pedido do cliente para definir o alvo.

Por este motivo, o código não adiciona deployment workflow, credenciais, artefatos `_redirects`/`_headers` de produção nem atalhos de publicação. Os gates de GSC/crawl real, CRM e LGPD, preços/contratos, VPS de homologação e autorização exclusiva para merge/DNS/Cloudflare seguem pendentes.

Nenhum dado pessoal real, chamada remota, custo, lançamento ou merge na `main`.

## Entry point de build protegido e prova dos arquivos

O comando `npm run build:protected` executa `scripts/build-protected-release.mjs` e **somente funciona** com alvo `staging` ou `production` e `IMAGINE_CATALOG_REQUIRE_SIGNED=1`. Ele não realiza publicação:

1. Remove **evidências anteriores e a árvore `dist/` anterior antes de validar quaisquer entradas**, para impedir que um erro de configuração deixe um pacote antigo aparentemente publicável. Esse comportamento é deliberadamente destrutivo apenas no diretório local `dist/`; executá-lo em um workspace descartável do pipeline.
2. Exige arquivos locais regulares de envelope e chave pública (com limites de tamanho), keyId esperado e os pins exatos de releaseId e SHA-256.
3. Verifica assinatura Ed25519 e os pins **antes** da compilação, apaga o `dist/` anterior e executa `astro build` com os mesmos inputs protegidos.
4. Recusa links simbólicos na árvore compilada, arquivos inesperados ou faltantes, e compara os metadados assinados com HTML, canonical e texto compilado.
5. Produz apenas `artifacts/protected-build-review/PROTECTED-BUILD-REVIEW-ONLY.json` com alvo declarado, releaseId, keyId público, SHA-256 do catálogo, SHA-256 da árvore compilada e contagem de páginas verificadas. Ele **não cria atestação assinada por chave operacional, recibo externo, publicação ou rollback remoto**.

Comando previsto para futuro orquestrador protegido, após receber artefatos e autorizações do Portal (não executar com dados reais no GitHub público):

```bash
IMAGINE_RELEASE_TARGET=staging \\
IMAGINE_CATALOG_REQUIRE_SIGNED=1 \\
IMAGINE_CATALOG_ENVELOPE_FILE=/caminho/privado/catalogo.json \\
IMAGINE_CATALOG_PUBLIC_KEY_FILE=/caminho/privado/issuer.pub.pem \\
IMAGINE_CATALOG_TRUSTED_KEY_ID=portal_key_aprovada \\
IMAGINE_CATALOG_EXPECTED_RELEASE_ID=release_validado \\
IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256=<sha256_validado> \\
npm run build:protected
```

O exemplo acima é **apenas documental** e não inclui chaves, valores, sessão nem aprovação reais. O E2E de CI executa o mesmo entry point apenas com chaves e dados sintéticos descartáveis e comprova recusa em modo `review`, produção sem assinatura e staging/produção com flag desativada.
