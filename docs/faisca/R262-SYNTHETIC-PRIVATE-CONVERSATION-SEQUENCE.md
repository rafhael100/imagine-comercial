# R262 — sequenciamento sintético do staging privado (DRAFT)

Base: R261 #740, HEAD `e8c012884f25ea82436d622972220f19c639c535`.
A R95 #570 está aprovada em CI na SHA `91951653fca999f26595cc8113fbaff151225a89`, mas não há comprovação de instalação da R95 na VPS.

## Entrega

O teste `tests/faisca-r262-negative-to-private-conversation.test.mjs`
executa uma cadeia **somente de laboratório**, sem dados reais:

1. Usa evidência Nginx R257 **injetada e sintética**, validada pelo
   contrato exato da R259 (23 verificações simuladas nesta etapa).
2. Executa no servidor Node real da R95 quatro sondas HTTP anônimas
   GET/OPTIONS de R258, com origem fixa loopback e sem token.
3. Comprova que as 27 verificações do relatório R259 (23 por contrato
   sintético + 4 HTTP reais locais) não chamam nenhum modelo.
4. Só depois, executa POST autenticado em loopback com pergunta fictícia.
   Respostas Luna e Terra são produzidas por `fetchImpl` simulado.
   Verifica `store:false`, `tools:[]`, ordem dos modelos, envelope,
   revisão editorial e proibição de ações públicas.
5. Verifica que pergunta comercial de preço recebe o texto editorial fixado,
   sem novas chamadas, e que PII sintética é rejeitada. Origem cruzada
   é bloqueada antes de qualquer chamada ao modelo.
6. Uma evidência Nginx falsa é recusada sem sondar API nem iniciar POST.

A lista de 27 verificações **não representa 27 observações reais de Docker**:
as 23 relativas ao Nginx são deliberadamente mockadas no teste e apenas
as quatro sondas anônimas da API ocorrem por HTTP loopback. A resposta
autenticada é gerada sem chamadas à OpenAI.

## Executar

`node --test tests/faisca-r262-negative-to-private-conversation.test.mjs`

A CI Node/HTTP, Chromium/axe/WCAG, SEO/build, Portal/Onepage,
PostgreSQL descartável e PHP permanece obrigatória na HEAD exata da PR.
Nenhum teste de CI comprova implantação, credenciais, origem da imagem Docker,
propriedade dos processos, reconciliação externa de gastos ou atendimento
público.

**NO-GO**: preservados site público, mascote, `main` e
`publicFaiscaEnabled=false`. Sem merge, deploy, VPS/DNS, dados reais,
chaves, chamadas pagas, CRM/Portal/Sites ou geração de cobrança, lead
ou ticket. A homologação R92 e os testes reais Luna/Terra já relatados
não são repetidos.
