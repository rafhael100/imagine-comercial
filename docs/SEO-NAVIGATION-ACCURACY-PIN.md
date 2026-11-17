# Comercial — pin do auditor de navegação corrigido

**DRAFT / REVIEW ONLY / NO-MERGE / NO-DEPLOY / NO-DNS.**

O CI passa de `0eae548cf474c2932c66a933fa88e7d8b1ebc7d4` para a revisão
imutável do SEO Engine `d5af3feb7af58a439b3ea778ccf45452d79e6b6b`.
O workflow e os dois testes que conferem o pin permanecem sincronizados.

A revisão incorpora duas correções verificadas:

- [Engine #315](https://github.com/rafhael100/imagine-seo-engine/pull/315):
  links relativos usam a URL da página de origem, preservando o grafo real.
  BASE href ativo exige revisão explícita, sem simular `document.baseURI`.
- [Engine #316](https://github.com/rafhael100/imagine-seo-engine/pull/316):
  âncoras e IDs escritos como exemplos em raw text/RCDATA ou atributos não
  são tratados como elementos reais. IDs reais nos containers continuam válidos.

As duas entregas acrescentam **55 regressões** (27 + 28). A suíte cumulativa
do Engine foi validada com **1.043/1.043 testes** em Node 24.22.1 antes da
promoção deste pin. A aprovação operacional permanece separada do CI.

## Verificação local do consumidor

Base Comercial: `7d2c2fd231b6c1089da0afd831681ffec5c8b7e8`.
Engine local confirmado na SHA exata acima, com árvore limpa.

| Verificação | Resultado |
|---|---|
| Testes de pin SEO e Actions imutáveis | 6/6 |
| Suíte `npm test` Comercial | 1.055/1.055 |
| Build Astro | Concluído; 64 páginas, incluindo 404 |
| `npm run check:dist` | 63 rotas públicas, sitemap e robots válidos |
| Auditor Engine no dist real | 63 páginas; zero erros e zero avisos |
| Grafo de navegação | 63 alcançáveis, zero órfãs, máximo 3 cliques |

Comando do auditor, preservado com suas quatro flags:

```bash
node ../imagine-seo-engine/scripts/audit-dist.mjs dist \
  https://imaginecomunicacao.com.br/ \
  --fail-on-warnings --strict-public-head --multilingual --check-hreflang
```

Todos os comandos locais terminaram com exit code 0 em Node 24.22.1. As SHAs
das GitHub Actions, o pin do assinador Portal e as permissões do workflow não
mudam. Chromium, Workerd e demais integrações remotas devem ser conferidos na
SHA final da PR Comercial. Nenhum resultado desta etapa comprova publicação,
tráfego, OAuth/GSC real, homologação da VPS ou liberação de checkout.
