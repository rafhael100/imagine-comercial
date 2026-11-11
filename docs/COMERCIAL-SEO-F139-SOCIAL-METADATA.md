# Comercial F139 — Metadados sociais consistentes para artigos e páginas

O layout Astro da Imagine passa a declarar `og:type=article` em conteúdos editoriais individuais e `og:type=website` nas demais páginas; adiciona tags Twitter Summary com título, descrição e URL canônica. Os valores são derivados dos mesmos dados estruturados do layout, evitando divergências entre OpenGraph, Twitter e canonical.

O verificador F21 de HTML indexável agora exige tipo OG correto por rota e igualdade exata entre URL canônica, OG URL, Twitter URL e os textos de descrição e título. Testes negativos detectam social card alterado, URLs externas, duplicidade e marcação equivocada de artigos. Páginas `noindex` continuam sem publicação de URL canônica nem dados estruturados públicos.

Nenhum conteúdo, autoria, data ou preço foi inventado. Essas mudanças aprimoram consistência de compartilhamento e indexabilidade técnica, **sem prometer ganhos de posição no Google**. Apenas branch de desenvolvimento/CI, sem deploy, DNS, redirect, merge main ou dados pessoais.
