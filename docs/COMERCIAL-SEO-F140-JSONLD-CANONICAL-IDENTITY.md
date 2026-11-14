# Comercial F140 — Integridade do JSON-LD e das URLs canônicas

Cada página pública do site Imagine recebe um `WebPage` com ID absoluto `#webpage` ligado à URL canônica. Guias editoriais usam `Article` com `#article`, `url` e `mainEntityOfPage` iguais ao canonical; páginas de serviços usam `Service` com `#service`, URL canônica, tipo de serviço e provedor corporativo referenciado pelo ID fixo da organização.

O verificador de build `verifyJsonLdPage` analisa **cada HTML Astro gerado** e rejeita documentos sem Organization/WebPage, entidades duplicadas, Article/Service fora das rotas correspondentes, identidades ou URLs divergentes, breadcrumbs que apontam para outro destino e tipos JSON-LD inesperados. A validação integra o comando `scripts/verify-dist.mjs`, executado duas vezes pelo CI do Comercial.

Não foram incluídos autores, datas, preços, endereços, depoimentos, avaliações ou resultados de busca inventados. A mudança aumenta a integridade semântica, sem prometer ranking ou rich results. Apenas branch e CI; sem deploy, DNS, redirecionamento 301, uso de dados reais ou merge na main.
