# F250 — Filtros funcionais no catálogo Imagine Comercial

O catálogo já tinha seis páginas de serviços estáticas, um orientador de objetivos e uma tela comparativa, mas ainda obrigava o visitante a percorrer os seis cartões para encontrar uma área de atuação.

A F250 adiciona filtros acessíveis diretamente à página `/servicos/`:

- **Todos os serviços** (6);
- **Sites e páginas** (criação de sites, Landing Pages e Onepage);
- **Assinatura** (sites por assinatura);
- **Anúncios** (Google Ads e Meta Ads).

A lista é uma classificação editorial fechada de serviços já existentes, não uma oferta, preço ou avaliação de elegibilidade. Os seis cartões continuam gerados no HTML Astro inicial e o visitante com JavaScript desabilitado vê todos. Os filtros são exibidos somente quando o JavaScript local está disponível, com `aria-pressed`, `aria-controls`, `role=status`, `aria-live=polite` e alvos de toque de 44px. A seleção altera apenas a propriedade `hidden` dos cartões e não toca no orientador de objetivos.

O módulo `src/data/service-catalog-groups.mjs` valida em tempo de build que **cada slug cadastrado possui exatamente uma categoria conhecida**. Qualquer catálogo com serviço novo e não classificado falha explicitamente, evitando ocultação silenciosa de uma oferta. Nomes e descrições continuam vindo do catálogo publicável homologado para o build, sem mudar URLs ou adicionar preços.

**Privacidade e segurança:** nenhuma pesquisa digitada, cookie, localStorage, telemetria, parâmetro de URL, captura de contato, requisição ou formulário foi adicionado. Testes Node e Chromium verificam todos os estados, foco e fallback sem JavaScript. A mudança é exclusiva de DEV; não representa aprovação para publicação pública, DNS/301 ou coleta real de dados.
