# Faísca R117 — preflight de privacidade no navegador privado

**Base:** R116 #591, SHA `3625a131fc0938fc35a7cf4a2c45636c38eb75ac`. A mudança é empilhada, isolada e restrita à interface privada; nenhuma ação operacional.

## Problema real

Na conversa fictícia R95, o campo de texto só verificava confirmação manual, tamanho e token **antes do POST**. O servidor já rejeitava CPF, contatos, URLs e segredos em outro limite antes da OpenAI, mas o navegador ainda enviava o conteúdo sensível ao HTTP loopback. Isso não é necessário e dá retorno de qualidade ruim ao operador.

## Entrega

- Adiciona uma barreira **conservadora na interface**, antes do `fetch`, para URL, e-mail, CPF/CNPJ/documentos, contatos, números extensos Unicode, segredos, credenciais, dados de clientes e caracteres invisíveis/de controle.
- Em negativa, limpa o token transitório e não envia POST. A validação é duplicada intencionalmente e **não substitui** o gate `readPrivateSyntheticQuestion` no servidor: browser pode ser modificado pelo operador e nenhuma heurística lexical certifica LGPD.
- Preserva a escolha de três cenários fixos, o limite de requisições, controles financeiros, scripts sem storage/cookies, CSP, `textContent` e a expiração independente da R116.
- Mantém perguntas fictícias legítimas disponíveis no caminho privado sem custo extra da verificação.

## Reprodução

```bash
node --test tests/faisca-r117-browser-question-preflight.test.mjs
node --test tests/faisca-r116-private-browser-fetch-deadline.test.mjs
node --test tests/faisca-r95-private-conversation-composition.test.mjs
npm test
```

Teste JS exato em VM com DOM mínimo e fetch injetado: oito recusas sem POST, token limpo, botão liberado e um envio permitido que recebe 503 sintético. CI HTTP/Chromium/axe/SEO e revisão independente permanecem obrigatórios.

## Gates pendentes

R95–R117 **não estão comprovadamente instaladas** na VPS. Respeitar homologação R92 relatada pelo operador. Revisão de AppSec/privacidade/editorial da cadeia acumulada, preflight SHA e smoke em staging com operador autorizado antecedem qualquer teste privado pago. Autenticação, autoridade empresarial, contratos e recibos do Portal, além de GO humano separado, antecedem atendimento público.

**NO-GO:** `publicFaiscaEnabled=false`, `main`, site público e mascote aprovados preservados. Sem merge/deploy/DNS/VPS/chaves/PII, API paga, CRM/Portal operacional, leads, tickets ou cobranças.
