# F173 — Corrida assíncrona no contato: copiar texto ou link

## Problema

No contato comercial, os botões “Copiar mensagem” e “Copiar link deste briefing” esperavam uma Promise do Clipboard API. Se a pessoa alterasse serviço, objetivo, momento ou prioridade **antes** da conclusão, a confirmação de sucesso/erro da seleção antiga poderia aparecer sobre a prévia nova. A tentativa simultânea de duas cópias também podia deixar o conteúdo final da área de transferência diferente da mensagem sinalizada.

## Alteração funcional

Em `src/pages/contato.astro` ambos os botões compartilham uma trava temporária de operação em andamento e uma revisão incremental do estado. O clique bloqueia apenas os dois controles de cópia até o fim do Clipboard API; seletores, links WhatsApp e mailto continuam funcionando. Cada alteração de briefing invalida a confirmação antiga. Ao terminar, uma Promise antiga jamais exibe sucesso ou erro da seleção anterior, e os botões são desbloqueados inclusive quando a API rejeita a escrita.

O comportamento com **JavaScript desabilitado** não muda: cópias ocultas, canais externos com URLs aprovadas disponíveis. Nenhuma informação é salva, enviada ou coletada.

## Evidência e escopo

Testes Node inspecionam os dois handlers e os caminhos de invalidação. Playwright Chromium usa uma Promise de clipboard controlada no browser para reproduzir atrasos, mudança de prioridade enquanto a cópia ainda não terminou, rejeição após mudança de momento, tentativa simultânea bloqueada e confirmação correta após uma cópia válida. QA executa em mobile e desktop, além da suíte SEO e acessibilidade existente.

Não cria endpoint de orçamento, não envia lead, não toca em chaves, Portal/CRM, VPS, produção ou DNS. Não substitui a homologação F70.
