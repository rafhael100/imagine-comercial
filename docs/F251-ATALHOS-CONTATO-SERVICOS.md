# F251 — Acesso direto do catálogo ao contato contextualizado

Na listagem `/servicos/`, cada um dos seis serviços publicados exibe agora duas ações distintas: **Conhecer serviço** (página editorial completa) e **Preparar contato** (abre `/contato/#<slug>` com o serviço já selecionado).

A ação de contato utiliza apenas o slug público revisado de `services.mjs`. O catálogo, incluindo os filtros de categoria F250, permanece integralmente gerado pelo Astro no servidor e pode ser navegado sem JavaScript. A tela de contato preserva o fluxo atual de escolha de objetivo, etapa e prioridade, sem formulário público. Os dois caminhos não adicionam token, email pessoal, nome ou query ao endereço.

## Experiência e acessibilidade
- Destino com `aria-label` específico do serviço e ação legível.
- Um aviso na listagem explica que preparar contato **não envia dados**; ele é vinculado a cada atalho via `aria-describedby`.
- Os botões/links possuem no mínimo 44px de altura e contorno visível ao navegar pelo teclado.
- O contato pode ser preparado pelos canais externos aprovados de forma independente após o visitante revisar o conteúdo da mensagem.

## Testes e limites
Os testes de contrato validam os seis slugs públicos, os rótulos e a ausência de submissão, e Chromium verifica que o destino `/contato/#gestao-google-ads` seleciona o serviço correto. Nenhum token ou dado de visitante é transmitido pela navegação interna.

Esta é uma melhoria de usabilidade em DEV, sem ativação do formulário legado, API, preço, checkout, produção, DNS ou redirecionamentos históricos. Os gates de Leaseweb, Portal→CRM, LGPD, AppSec, DBA e aprovação do proprietário continuam independentes.
