# Faísca R57 — fronteira HTTP local do classificador de respostas

**Base:** R56 #525, R55 #523, candidata comercial R51 #504. **Somente laboratório privado**. Nenhuma conexão com serviço de IA ou outro domínio.

## Objetivo

O R47–R49 já construiu o contrato de saída mínimo do seletor: transmite somente IDs editoriais revisados, e um verificador no host escolhe entre respostas também revisadas. A R57 demonstra **esse protocolo sobre HTTP real em loopback** em vez de apenas callback JavaScript, com rejeições verificáveis de endereço, resposta, prazo e tentativas de ampliar o contrato.

## Implementação

- `ops/faisca/model-router/loopback-selector.mjs` contém um cliente Node sem host remoto configurável: exige endereço literal `http://127.0.0.1:PORT/candidate-only`; só aceita porta válida, prazo 50–3000 ms, `POST` JSON, `redirect: error`, nenhum cookie ou dado de acesso. Não aceita URL com query, fragmento, usuário/senha, DNS ou IP diferente.
- Usa `buildCandidateOnlyRouteEgress`, `serializeCandidateOnlyWireRequest` (máximo 1.024 bytes) e `parseCandidateOnlyWireDecision` (máximo 256 bytes). O leitor interrompe respostas grandes e não confia em content-type incorreto, HTTP não-200, seletor que responde texto, ferramentas ou IDs inventados. A correlação de mensagem é recolocada **somente no host**.
- `tests/faisca-r57-loopback-selector.test.mjs`: abre um servidor local temporário, verifica bytes reais, resposta validada, replay sem reenvio pelo runtime, recusa de destino externo/redirecionamento, resposta forjada/oversized, deadline e request falsificado.

## Comandos reproduzíveis

```sh
node --test tests/faisca-r57-loopback-selector.test.mjs
node --test tests/faisca-*.test.mjs
```

O mecanismo nunca contém endpoint, token, chave de API, modelo ou credencial real. Sem DNS, proxy remoto, gateway de IA ou dependências de rede. O fixture recebe apenas os IDs previstos; **não identifica o cliente, não recebe o texto da mensagem, não grava conversa, não gera respostas nem faz cobrança**. A designação `kind: 'simulated'` é proposital.

## Para uso futuro de IA real: gates bloqueantes

- Serviço/modelo e provedor comercial aprovados com avaliação LGPD, DPA, região e retenção.
- Infraestrutura no servidor com egress allowlist, SSRF hardening, MFA/IAM e rotação de segredos; segredos não podem chegar ao navegador.
- Limites **duráveis** de orçamento/tokens por empresa, concorrência, rate limit, circuit breaker, reconciliação após timeout e logs sem dados pessoais.
- Revisão de como um classificador realmente selecionaria IDs sem acessar mensagens privadas; não transformar simulação com IDs em afirmação de IA conversacional.
- Revisão independente de AppSec, navegador, compatibilidade PHP, testes adversariais e GO operacional.

**Proibidos**: merge, deploy, DNS, VPS, rede externa, cobrança, contratação de modelo, dados reais, modificação no mascote ou `src/`/`public/`. `publicFaiscaEnabled=false`.
