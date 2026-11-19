# Faísca R28 — preservar as correções comerciais F357 na integração privada

**Base:** Faísca R27 [#491](https://github.com/rafhael100/imagine-comercial/pull/491); projeto Imagine Comercial.  
**Fonte paralela:** Comercial F357 [#490](https://github.com/rafhael100/imagine-comercial/pull/490), base independente.  
**Status:** composição candidata em PR **draft**, sem `main` ou deploy.

## Por que

A linha Faísca R24–R27 integrou o HTML Astro real ao assistente local. Paralelamente, a F357 corrigiu um defeito de conversão do simulador: `aria-disabled=true` e `tabIndex=-1` em um link não impediam clique com mouse após esvaziar a seleção. Também eliminou a duplicação do número WhatsApp dentro do construtor de URL.

A comparação GitHub apontou históricos divergentes a partir do ancestral comum `a4f4eb9687b6dfd9c0d45e88e8345cc37198cd6e`. Misturar branches diretamente, sem conferir os arquivos e os testes, poderia perder uma das correções. **R28 porta exclusivamente o recorte funcional da F357 para a candidata Faísca**, sem importar documentação, secrets, endpoints, checkout ou trabalhos comerciais paralelos.

## Código incorporado

- `src/components/CommercialChoicePreview.astro`: intercepta o clique do CTA de contato quando o carrinho está vazio e marcado como `aria-disabled=true`; não permite navegação involuntária.
- `src/data/reviewed-quote-choice-href.mjs`: usa `contactWhatsAppUrl(reviewedQuoteChoiceMessage(...))` do catálogo público único, sem novo número, canal ou URL.
- `tests/reviewed-quote-contact.test.mjs`: valida **138 variações** de site, canais, faixa e idioma PT/EN/ES, com URL exata, mensagem curada e rejeição de parâmetro extra.
- `scripts/browser-qa.mjs`: clique sintético cancelável no CTA vazio deve retornar `false`, sem navegar.
- `ops/faisca/composition/browser-qa.mjs`: verifica o mesmo bloqueio **dentro da composição privada R24/R25**, depois confirma que a seleção Onepage volta a habilitar uma URL de WhatsApp permitida e que o assistente continua acessível.
- A prova negativa R27 de JavaScript ausente e módulo Faísca indisponível foi sincronizada com a versão corrigida da PR mãe.

## Critérios e autorização

CI Node, Chromium, PHP pinado, PostgreSQL efêmero e build/SEO devem passar **na SHA desta PR**. A validação deve confirmar que o R26 continua recusando qualquer arquivo de prévia Faísca no `dist` público. Antes de compor ou promover F357 e Faísca, uma revisão independente deve conferir se o mesmo ajuste funcional já entrou por outro caminho, evitando duplicação e conflitos de histórico.

A F357 permanece em sua PR original; esta entrega **não faz merge da F357, nem da R27, nem de qualquer trabalho na `main`**. Não houve alteração de preço oficial, DNS, VPS, credencial, cobrança, cliente real, PSP, CRM, Portal, provedor de IA ou mascote aprovado. O contato WhatsApp ainda depende da reconfirmação dos canais públicos antes de produção.

## Gate pendente de release

O serviço Faísca continua sem IA generativa externa, lead, autenticação privada do cliente e checkout real. A experiência existente é uma revisão local protegida; disponibilidade operacional requer integração com Portal/CRM, staging HTTPS seguro, backup/restauração, AppSec/LGPD e autorização específica de GO.
