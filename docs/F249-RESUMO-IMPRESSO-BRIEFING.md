# F249 — Resumo imprimível do briefing de contato

## Funcionalidade

O visitante da página `/contato/` já consegue escolher serviço, objetivo, etapa e prioridade entre opções públicas curadas e preparar a mensagem de WhatsApp/e-mail. A F249 acrescenta um botão **Imprimir resumo do briefing**, exibido somente quando o navegador possui API de impressão. Um clique explícito abre a impressão nativa.

A folha contém:
- identidade Imagine e título do resumo;
- serviço, objetivo, momento do projeto e prioridade, sempre derivados das opções existentes;
- mensagem de atendimento já preparada, sem texto livre;
- aviso de que nada foi enviado, contratado ou autorizado pelo site.

No modo impressão, o menu, links externos, controles e rodapé são ocultados. No modo tela, o resumo especial é invisível e os canais usuais continuam operacionais. Sem JavaScript, o botão fica oculto e o contato por links estáticos/WhatsApp/e-mail permanece disponível.

## Privacidade e segurança

A aplicação utiliza somente `textContent` para inserir títulos de opções e mensagem revisada, nunca `innerHTML`. Não pede nome, e-mail pessoal, CPF, endereço ou upload; não envia `fetch`, `POST`, telemetria ou armazenamento. O usuário controla o diálogo nativo de impressão, sem renderização ou persistência de PDF pelo site.

## Validação

Testes Node conferem a ausência de captura, a atualização de dados curados e as regras CSS. O QA Chromium substitui `window.print` por um spy local, verifica que a impressão não ocorre automaticamente, que exige clique real, e usa `emulateMedia({media:'print'})` para confirmar que a folha contém somente o resumo, sem cabeçalho ou ações externas.

**Limites:** não é formulário público nem recibo de contratação, tampouco comprova integração operacional Portal→CRM. Não altera DNS, redirecionamentos, API pública, domínio canônico, `main` nem ambiente de produção.
