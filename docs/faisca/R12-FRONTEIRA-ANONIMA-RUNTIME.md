# Faísca R12 — fronteira anônima no runtime assíncrono e pipeline de respostas

**Repositório:** `rafhael100/imagine-comercial`  
**Base:** Faísca R11, PR #474, SHA `9186bb178dfb973cdae470c8b59295725c79b100`.  
**Status:** implementação de laboratório em PR draft, sem integração na main.

## Lacuna eliminada

Na R11, a interface `routeWithLocalFixture` retornava uma explicação fixa para dúvidas sobre pedidos, faturas, cancelamentos, suporte e CRM. Mas o caminho de produção futura `createGroundedModelPipeline` passa pelo `createModelRouteRuntime`, que tentava construir a requisição de modelo, rejeitada pelo preflight para esses assuntos. Em vez de orientar o visitante, a pipeline retornava erro genérico. Nenhuma consulta privada era feita, mas as duas interfaces exibiam comportamentos diferentes.

## Implementação

1. `getAnonymousRouteBoundary(userText)` agora compartilha a mesma resposta fixa R11 entre demonstração direta e runtime. O preflight continua recusando PII, credenciais, prompt injection, texto inválido e mensagens longas. Nenhuma mensagem privada é roteada para resposta editorial ou modelo.
2. O runtime reconhece a orientação fixa **antes** de construir a requisição de modelo, registra uma resposta local idempotente, mantém `sources=[]`, `actions=[]`, `externalModelInvocations=0` e `operationalEffects=false`, e a disponibiliza em `send` e `reconcile`.
3. Essa orientação pode ser fornecida mesmo quando uma pergunta editorial distinta permanece pendente na mesma conversa. Ela não libera nem reenvia a pendência anterior e não dispara o provedor.
4. A leitura de campos de entrada no runtime usa apenas descritores de propriedades próprias, sem executar getters da aplicação chamadora.
5. `createGroundedModelPipeline` já preserva respostas não editoriais do roteador; por isso recebe a orientação local automaticamente, **sem chamar o PHP R06**. Para respostas editoriais públicas, a verificação R06/PHP segue obrigatória.

## Provas automatizadas

`tests/faisca-r12-anonymous-runtime.test.mjs` cobre:
- nove situações privadas e de encaminhamento, idênticas entre rota direta e assíncrona;
- replay de mensagem, colisão de ID, isolamento entre sessões e reconciliação;
- orientação privada durante resposta editorial pendente;
- pipeline sem chamadas ao roteador e ao PHP para orientação anônima;
- recusa de PII, senhas, injeção e getter hostil;
- resposta pública fundamentada, que ainda passa pelo caminho R06.

Reproduzir:

```bash
node --test tests/faisca-r11-anonymous-boundary.test.mjs tests/faisca-r12-anonymous-runtime.test.mjs tests/faisca-r09-runtime.test.mjs tests/faisca-r09-grounded-pipeline.test.mjs
npm test
```

O workflow `Faísca - demonstração guiada e acessibilidade` cobre `tests/faisca-*.test.mjs` no CI da PR. **Até o workflow dessa SHA terminar, não declarar testes verdes.**

## Limites e próximos gates

- O laboratório continua com roteador simulado e dados sintéticos. **Nenhuma IA generativa externa está conectada.**
- Não há clientes autenticados, consulta de contratos, geração de boleto, CRM, Portal, tickets, e-mail, voz, custos ou dados reais.
- A interface pública e o PNG do mascote aprovado não foram modificados.
- Antes de integrar, revisar R07–R12 de forma independente e conferir CI sobre a SHA exata da PR.
- Integração autenticada futura requer identidade, MFA, grants do Portal, consentimento, auditoria, revogação, recibo de destino e avaliação LGPD; nenhum desses gates foi contornado.
- **Sem merge, deploy, DNS, Cloudflare, VPS ou publicação.**
