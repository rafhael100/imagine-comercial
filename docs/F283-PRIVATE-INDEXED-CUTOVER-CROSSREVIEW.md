# F283 — Confronto privado: indexação do legado × plano de preservação

## Propósito

F276 detecta páginas legadas ainda indexadas por amostra normalizada de inspeções; F277 exige plano explícito para as 27 rotas conhecidas. A F283 correlaciona as duas fontes **em memória, sem gravar URLs, métricas, dados de Google Search Console ou aprovação de produção**.

O programa considera ambas as fontes **não autenticadas** e mantém NO-GO permanente. Nem 27/27 decisões e zero diferenças constituem prova de cobertura total, HTTP real, posse do domínio, equivalência editorial, aceites ou liberação de publicação.

## Arquivo privado

Criar **fora do repositório** um JSON de exemplo com dados *sintéticos*:

```json
{
  "inspections": [
    {"url": "https://www.imaginecomunicacao.com.br/en-us/", "verdict": "PASS"},
    {"url": "https://www.imaginecomunicacao.com.br/fale-conosco.html", "verdict": "PASS"}
  ],
  "decisions": [
    {"from": "/en-us/", "plan": "retain-original"},
    {"from": "/fale-conosco.html", "plan": "review-redirect"}
  ]
}
```

Somente `url` e `verdict` nas inspeções; somente `from` e `plan` nas decisões. As decisões válidas são `retain-original`, `review-redirect` (apenas uma das cinco candidatas) e `pending`. Não inserir tokens, PII, cliques, impressões, identificadores de autenticação ou links de inspeção.

```bash
node scripts/review-private-index-cutover.mjs --file /caminho/privado/inspections-and-decisions.json
```

O comando é bloqueado em GitHub Actions, não realiza rede, não cria arquivos e imprime **somente contagens**. `indexedHeldMissingRetainAssertion` e `indexedPathsOutsideInventory` maiores que zero exigem revisão prioritária. Query strings e variantes HTTP são incertas, não comprovação de preservação.

## Limites de release

A amostra privada não substitui inventário completo, crawl HTTP real, evidência de backlinks, revisão de canonical/hreflang e planos de conteúdo, LGPD/jurídico, homologação TLS/SSH/Cloudflare ou rollback.

**Proibido** interpretar o resultado como autorização de eliminar páginas legadas, publicar `_redirects`, trocar `www` por apex, alterar DNS, fazer deploy, configurar CRM ou liberar `main`. Todos esses gates permanecem externos e sujeitos a aprovação independente.
