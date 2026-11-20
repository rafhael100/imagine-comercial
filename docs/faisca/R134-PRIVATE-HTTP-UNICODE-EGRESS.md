# Faísca R134 — egress HTTP autoritativo contra Unicode invisível

**Base:** R133 #608, HEAD `fc889d33051b58d7559a2f0444e1c767019a7687` (CI 6/6). Revisão apenas em branch isolada e PR draft.

## Falha delimitada

A R131 protege o **navegador** contra caracteres `Default_Ignorable_Code_Point` em respostas, enquanto a R133 protege a **entrada HTTP** das perguntas fictícias. A saída HTTP do servidor privado ainda podia serializar um texto sintético contendo U+034F (combining grapheme joiner), que não é `Cc` nem `Cf` e pode escapar de filtros pontuais do servidor. Não há evidência de exposição pública, mas um consumidor HTTP privado que não usa o navegador ficava sem a mesma defesa.

## Correção

- `safeReviewOutput` e `safeConversationOutput` agora rejeitam qualquer caractere da propriedade Unicode `Default_Ignorable_Code_Point` **antes de serializar** respostas de modelo no HTTP privado.
- Inclui respostas dos três cenários fixos e a conversa fictícia livre; a rejeição responde `503 unavailable` genérico, sem ecoar texto nem fontes e sem novas tentativas automáticas.
- Nenhum texto é normalizado/limpo para aceitar conteúdo perigoso, e o modelo não recebe autoridade de publicação/checkout.

## Validação executável

`node --test tests/faisca-r134-private-http-invisible-egress.test.mjs` faz HTTP autenticado real em loopback com provedores **sintéticos**; testa U+034F, U+200D, U+00AD e U+FE0F em ambos os endpoints e mantém controle positivo 200. Exige ausência do texto rejeitado no corpo de resposta e contagem exata sem retry. Em CI, executar a matriz Faísca Node/HTTP/Chromium/axe, Comercial SEO/build/navegador, Portal Onepage e demais workflows fixados. A CI deve ser consultada na HEAD exata; green não é homologação da VPS.

## Operação e gates

- Homologação R92 concluída por relato do operador; não repetir sem causa. **Não presumir R95–R134 instaladas na VPS.**
- Próximo passo: revisão AppSec/editorial independente e homologação privada da composição acumulada; não enviar mensagens ou dados de cliente nem consultar chave da OpenAI.
- Ledger permanece estimativa local monotônica de reservas, não limite global oficial da API.
- **NO-GO público:** `publicFaiscaEnabled=false`, mascote aprovado, site público e `main` preservados. Sem merge/deploy, DNS/VPS, dados reais, CRM/Portal operacional, leads, tickets, checkout ou pagamentos.
