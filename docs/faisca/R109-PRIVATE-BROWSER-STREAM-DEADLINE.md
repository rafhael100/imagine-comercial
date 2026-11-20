# Faísca R109 — streaming HTTP do navegador privado com deadline independente

**Base:** R108 #583, HEAD verificada `f36fd612355e0586dfb3d8f7458d0e7c42a8bf40`; R95 #570 e R86 de staging #561 com 6/6 workflows aprovados em suas SHAs. **DRAFT / fixture only.** Sem alterar a branch de R108 nem executar trabalho concorrente.

## Falha reproduzível

O navegador privado R90 impunha máximo de 16 KiB e 35 segundos, porém `await reader.read()` não escutava `AbortSignal` e o bloco `finally` fazia `await reader.cancel()`. Um stream HTTP não cooperativo podia, portanto, manter o botão **Gerar resposta pela IA** desabilitado além do timeout, sem limpar o texto/transitórios nem fornecer erro recuperável. O timeout do servidor R107 não garante interrupção do leitor do browser.

## Incremento de código

- `PRIVATE_REVIEW_JS` passa a aguardar `reader.read()` e o aborto por `Promise.race`, removendo o listener em `finally`. Usa erro genérico e não persiste pergunta/token.
- O `reader.cancel()` é solicitado sem aguardar sua Promise, cuja implementação também pode travar; o navegador recupera seu estado no timeout.
- Testes Node executam o próprio script de browser em VM, simulam `read()` e `cancel()` que nunca resolvem, validam leitura JSON normal e rejeitam `Content-Length` acima de 16 KiB sem consumir bytes.
- QA Chromium intercepta `fetch` local e devolve corpo sintético que nunca produz chunks; acelera exclusivamente o timer de teste de 35 s e exige UI recuperada, token limpo e nenhuma nova chamada ao provedor.
- Suítes HTTP do R95–R108, Chromium/axe, compatibilidade Portal Onepage, PHP, PostgreSQL e Comercial/SEO continuam como gates de CI. Nenhum recurso pago, chave, dado pessoal ou integração operacional.

## Limitações e gates externos

Esse reparo protege contra **reader não cooperativo e cleanup pendente**, não garante cancelamento de cobrança na OpenAI. A proteção R107/R108 no servidor e o ledger durável continuam independentes. Revisão AppSec/editorial e homologação privada posterior à R92 dependem de operador com SHA pinada; não presumir que R95–R109 estejam instaladas na VPS. Um único teste pago relatado anteriormente não constitui certificação.

**NO-GO público:** `publicFaiscaEnabled=false`, mascote/site público/`main` inalterados. Sem merge, deploy, DNS, VPS, LLM real, credenciais, Portal/CRM operacional, leads, tickets, contratos ou cobranças.

## Evidências

- [ ] 6/6 workflows na SHA exata da R109; anexar URLs após execução.
- [ ] Revisão independente de privacidade, streaming/AbortSignal e acessibilidade.
- [ ] Operador homologar a conversa fictícia na versão integrada com gastos/controlos auditados em staging.
