# Comercial SEO-F153 — Sumário navegável nos artigos da Imagine

Cada guia público recebe um **sumário de seções** gerado no build Astro a partir dos seus títulos editoriais, com links `#id` e marcadores determinísticos. O visitante consegue ir diretamente para uma seção em telas grandes ou pequenas, usar o recurso com teclado e compartilhar um trecho específico do guia. Nenhum JavaScript é necessário.

Os IDs são normalizados (sem acentos, com hífens) e recusam entradas inválidas e colisões entre seções. O mesmo conjunto de IDs serve ao sumário e às seções; o controle F147 já valida que cada `href="#id"` da página aponta para um alvo real. A hierarquia H1/H2 segue os testes de SEO e acessibilidade F146.

A implementação não cria outras URLs indexáveis, conteúdo novo, formulários, campos de entrada, cookies, rastreadores, `fetch` ou integração de captação. Playwright verifica cliques, fragmentos da URL e a versão sem JavaScript. O contrato editorial continua em revisão antes de qualquer liberação.

**HOLD:** PR draft e laboratório; sem merge `main`, staging/produção, alterações DNS, 301 ou custos extras.
