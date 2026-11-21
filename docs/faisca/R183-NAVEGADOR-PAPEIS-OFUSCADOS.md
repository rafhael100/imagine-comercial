# Faísca R183 — preflight independente no navegador

Esta PR é empilhada sobre a R182 (servidor autoritativo). Ela nega, antes do POST, perguntas artificiais com comandos fragmentados por pontuação/espaços, marcadores sintéticos de papéis e pedidos de revelação de prompts.

A interface continua sem chave de API, cookies ou storage. O token temporário, a confirmação e o texto são descartados após qualquer rejeição. Não são enviados ao servidor para serem normalizados. Em falha de validação, a resposta anterior e suas fontes são apagadas.

## Testes
- `node ops/faisca/openai/private-conversation-browser-qa.mjs` com Chromium/axe: interceptação do endpoint de conversa e **zero POST** para novas variantes; token/pergunta/checkbox apagados
- `node --test tests/faisca-r182-obfuscated-role-boundary.test.mjs`: a mesma família de variantes é recusada no servidor, com 400, zero despacho ao adaptador de IA
- Workflow completo `faisca-guided-lab.yml` e gates de build/SEO/Portal/PG/PHP quando disparados na HEAD da PR

Heurísticas não substituem DLP ou revisão editorial. Não há acesso a API paga nem comprovação de staging/VPS. Testes privados R92 já relatados não são repetidos; R95 não é presumida instalada. Mascote e comercial públicos preservados; `publicFaiscaEnabled=false`, sem merge/main/deploy/DNS/Portal/CRM/Sites operacionais, dados reais ou GO público.
