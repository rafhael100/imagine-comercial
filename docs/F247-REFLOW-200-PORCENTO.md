# F247 — Reflow responsivo equivalente a zoom de 200%

A diretriz Imagine Experience exige navegação legível em celular, tablet, desktop e zoom de 200%. Os testes anteriores cobriam 375px (celular), 960px (tablet), 1440px (desktop) e AxE, mas não exercitavam larguras particularmente restritas no mesmo fluxo.

## Novo ensaio real de navegador

Em Chromium local, após compilar o site Astro, abre dois novos contextos isolados, com **larguras CSS de 640px e 320px**, representando o espaço CSS efetivo aproximado de telas de 1280px e 640px vistas a 200% de ampliação.

Em cada uma de cinco páginas (`/`, `/servicos/`, `/servicos/landing-pages/`, `/contato/`, `/conteudos/`):
- exige resposta HTTP 200 e `main` presente;
- exige exibição de menu móvel nativo `details/summary`, ocultando o menu desktop;
- abre e fecha o menu e verifica que o link de contato permanece visível, sem JavaScript extra;
- recusa **overflow horizontal acima de 2px**;
- registra capturas de homepage em `artifacts/browser/f247-...-home.png` para revisão visual, com conteúdo público sintético, sem lead, cookie ou dados reais.

**Precisão do teste:** a redução da largura CSS verifica *reflow semelhante* ao zoom de 200%; ela **não aciona literalmente a função de zoom do navegador**, não testa configurações de acessibilidade do SO e não dispensa validação humana em 200% real. Não confundir dispositivo com ampliação tipográfica; leituras específicas de fontes ampliadas podem exigir outros testes.

Nenhum serviço externo, Google Search Console, Portal, CRM, DNS, VPS real, redirect, lead real, deploy ou produção é modificado pela F247.
