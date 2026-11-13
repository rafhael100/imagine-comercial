# F31 — Isolamento de captação de leads no site público

Data: 09/11/2026. Somente revisão do código e QA local, sem tráfego real.

## Objetivo
A F30 criou apenas um contrato sintético de dados de leads para desenvolvimento. Antes de criar ou publicar formulários, a F31 deve impedir que tal módulo seja importado acidentalmente por páginas públicas e transmitir dados de visitantes antes de existir aviso de privacidade, API segura e autorização.

## Controles automáticos
- Varredura do código Astro em `src/pages`, `src/components` e `src/layouts` rejeita importação de `lead-intake-lab`, endpoints de lead, formulários HTML, chamadas `fetch`, XHR ou `navigator.sendBeacon`. A restrição só deve ser retirada após implementação e revisão específica de uma API real.
- Testes Chromium em 15 URLs mobile e 6 desktop registram apenas método e **origem** das requisições, sem parâmetros de URL ou PII.
- O QA falha se houver POST, chamada a outra origem, cookies ou localStorage/sessionStorage preenchidos no fluxo de navegação e escolha de serviço.
- O site de contato deve informar que o formulário está pendente e que a seleção atual de serviço não envia dados, oferecendo WhatsApp e e-mail como canais externos explicitamente acionados pelo visitante.
- O backend mock de F30 permanece ausente do build público, não tem entrada HTTP, não persiste dados reais e não participa de qualquer deploy.

## Limites e próximos gates
Os controles são adequados ao estado atual do site estático. Quando as integrações de analytics, consentimento e captação forem aprovadas, as regras precisarão ser revisadas para testar **origens autorizadas e finalidade específica**, jamais simplesmente desabilitadas. Os testes não substituem política LGPD, pen-test, análise DPA de fornecedores nem proteção operacional de API.

Sem alteração de `main`, domínio, Cloudflare, DNS, credencial, cliente ou custo.
