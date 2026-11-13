# F276 — Revisão privada de URLs antigas ainda indexadas

## Problema
Antes de trocar o domínio público para o novo Astro, rotas legadas que o Google ainda reconhece podem desaparecer caso sejam tratadas como 404 sem uma decisão editorial/SEO. Esta rotina **não** substitui uma auditoria HTTP, a Search Console real, backlinks, políticas legais ou aprovação de redirecionamentos.

## Entrada mínima
Um operador autorizado prepara **fora do GitHub** um arquivo JSON com somente `url` e `verdict` para cada inspeção, como o exemplo **inteiramente fictício**:

```json
{
  "inspections": [
    {"url": "https://www.imaginecomunicacao.com.br/o-que-fazemos/marketplace-amazon.html", "verdict": "PASS"},
    {"url": "https://www.imaginecomunicacao.com.br/fale-conosco.html", "verdict": "NEUTRAL"}
  ]
}
```

Valores permitidos: `PASS`, `NEUTRAL`, `FAIL`, `VERDICT_UNSPECIFIED`. O veredicto precisa ser verificado pelo operador em fonte autorizada; os dados do arquivo são considerados **não autenticados** por este script. Não incluir URL de terceiro, token, consulta, dados pessoais, métricas, credenciais, cabeçalhos ou links de inspeção com identificadores. Uma URL observada com query é mantida em HOLD sem publicar seus parâmetros.

Execute somente em ambiente **privado**, nunca em GitHub Actions:

```bash
node scripts/review-private-gsc-index-holds.mjs --file /caminho/privado/inspections.json
```

A saída contém apenas contagens de caminhos legados indexados em HOLD, candidatos ainda dependentes de aprovação, URLs indexadas fora do inventário, variantes de protocolo/query e veredictos não positivos. Não revela caminhos ou métricas; não grava arquivos.

## Portas de aprovação inalteradas
- Mesmo zero URLs indexadas na amostra **não significa** cobertura completa.
- Nenhuma saída permite eliminar uma página em HOLD, criar `_redirects`, habilitar 301, mudar canonical/DNS ou publicar.
- É obrigatório revisar equivalência editorial/idioma, questões legais/LGPD, dados de crawl/HTTP e histórico real de buscas e backlinks.
- A origem operacional Google, o titular da propriedade e os grants do SEO Engine continuam sujeitos a verificação independente. O acesso do OpenSEO no ChatGPT não equivale à integração operacional do SEO Engine.

**Estado permanente:** NO-GO sem evidências e aprovação independente.
