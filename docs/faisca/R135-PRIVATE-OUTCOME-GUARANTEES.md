# Faísca R135 — promessas de resultados não fundamentadas

**Base:** R134 #609, HEAD `8175f9cc27bbc5777f7db5e71cf72817c0e9546f`, 6/6 workflows aprovados.

## Incremento de laboratório

Respostas da IA sobre marketing podem parecer informativas, mas afirmar como fatos **vendas, clientes, resultados e posições garantidas** sem dados verificáveis. Não existe autoridade nesta conversa privada para garantir desempenho de SEO, anúncios ou conversões.

A R135 introduz `hasPrivateUnsupportedOutcomeGuarantee` com tripwires lexicais conservadores em português normalizado. A função é usada em `safePrivateGeneralReply` e, de forma **independente**, nos gates de HTTP para perguntas fixas e conversa fictícia livre. Uma promessa identificada vira `503 unavailable` genérico, sem eco do conteúdo ou retry, preservando texto geral não-promissório.

**Limites:** lista de padrões não equivale a revisão editorial, detecção universal de alucinações ou avaliação da veracidade. Pode rejeitar frases legítimas que discutam garantias em sentido negativo; neste laboratório privado o erro conservador é aceitável. Qualidade semântica e fontes continuam dependentes de revisão humana.

## Testes sintéticos executáveis

- `node --test tests/faisca-r135-private-unfounded-outcomes.test.mjs` testa quatro alegações rejeitadas e resposta segura preservada.
- `node --test tests/faisca-r135-private-guarantee-http.test.mjs` executa os dois endpoints HTTP reais em loopback com provedores **fictícios** e bearer transitório fictício; rejeição sem eco, controle positivo e contagem sem repetição.
- Executar em CI Faísca/HTTP/Chromium/axe, Portal Onepage, PHP/PG descartável e Comercial/SEO/build, na HEAD exata da PR.

## Gates

Homologação R92 previamente relatada pelo operador; nenhuma instalação da R95–R135 na VPS foi presumida. Revisão independente AppSec/LGPD/editorial e staging privado acumulado permanecem pendentes. Sem acesso à chave e sem uso pago nesta entrega.

**NO-GO público:** não alterar `main`, mascote aprovado, site público ou `publicFaiscaEnabled=false`; sem merge, deploy, alterações em VPS/DNS, dados reais, emissão de tickets/leads, Portal/CRM operacional, checkout ou cobrança.
