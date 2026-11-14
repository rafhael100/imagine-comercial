# F246 — Rodapé funcional, agrupado e acessível

O rodapé anterior misturava cinco links em linha única e continha apenas um texto de marca, sem a logo original aprovada, sem agrupamento por objetivos e sem acesso direto aos canais públicos de atendimento.

## Entrega

- Rodapé responsivo **4 colunas no desktop, 2 no tablet, 1 no celular**, com superfícies leves e espaçamento do Imagine Experience System.
- Logomarca original `/logo-imagine.png` já preservada byte a byte no F240, carregada localmente e com link identificado por `aria-label`, sem dependências de serviço externo.
- Navegação com rótulos de landmark **Serviços** (catálogo, criação de sites, Landing Pages, comparação) e **Institucional** (sobre, processo, FAQ, conteúdo).
- Área de **Atendimento** com link para `/contato/`, email e WhatsApp do catálogo público revisado; link externo tem `target="_blank"` e `rel="noopener noreferrer"`. Aviso explícito de que os canais devem ser reconfirmados antes da publicação.
- Controles clicáveis com rótulos legíveis, links sublinhados e área mínima de 36 px com separação visual; sem scripts, cookies, eventos de rastreamento, formulário público nem API.

## Verificação

Node testa que todos os links internos pertencem a `sitePages`, que os contatos derivam de `contactChannels`, que o logo original não foi substituído e que há aviso de reconfirmação. O navegador QA percorre rotas mobile e desktop para verificar links úteis. WCAG/axe, orçamento estático e Lighthouse continuam gates de CI; a publicação real continua bloqueada.

**Não é homologação de canais reais, CRM, domínio, redirecionamentos ou VPS.** Nenhum merge em `main`, deploy, modificação de DNS, gasto ou ativação de coleta de leads é autorizado aqui.
