# F170 — Checklist interativa de preparação, com impressão local

## Funcionalidade

A página pública `/como-funciona/` já apresentava seis perguntas essenciais de preparação de projeto. A F170 transforma essa seção em **checklist progressiva**, com botão `Marcar como preparado` em cada pergunta, indicador acessível de progresso `x de 6 perguntas preparadas` e ação opcional `Imprimir roteiro para a reunião`.

A melhoria não transforma o conteúdo editorial em proposta comercial: as etapas, preços, prazos, materiais e responsabilidades continuam dependendo de escopo e contratação. O objetivo é permitir que o cliente organize suas perguntas **antes** de conversar com a Imagine.

Os seis itens vêm diretamente do catálogo editorial F64, sem texto livre, caixa de entrada, cookies, armazenamento local, `fetch` ou envio. O progresso fica **somente na memória da aba** e é apagado ao recarregar ou fechar. A impressão é uma ação explícita do visitante via mecanismo nativo do navegador, sem gerar arquivos no servidor ou acessar serviços externos.

**Progressive enhancement:** com JavaScript desligado, as seis perguntas continuam visíveis como lista normal e os botões de marcar/imprimir permanecem ocultos. Com JavaScript ligado, os botões usam `aria-pressed`, rótulos de estado e contador `role=status`/ `aria-live`. A folha de impressão oculta controles interativos, mantendo as perguntas.

A CI executa testes Node de ausência de PII/rede, além de Chromium real em mobile/desktop para marcar, desmarcar, contar, imprimir por clique, recarregar e comprovar reset, e verificar fallback sem JavaScript. Sem endpoint CRM, coleta, consentimento automático, lançamento, valores comerciais inventados ou alteração de produção.
