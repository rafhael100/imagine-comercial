# Faísca R02 — revisão independente de código

> Atualização posterior: o titular autorizou publicar o mascote e os documentos R02 no GitHub público. Os relatos abaixo descrevem a rodada local anterior; autorização, preparação e validações de publicação estão em `AUTORIZACAO-PUBLICACAO-R02.md`. Essa atualização não altera resultados de testes nem concede merge/deploy.


Data: 17/11/2026 (America/Sao_Paulo). Revisão somente de leitura do código; este parecer é o único arquivo criado pelo revisor.

## Resultado

**Nenhum bloqueador identificado na inspeção estática do recorte R02.** O código pode seguir para revisão funcional em navegador e continuação local. Esta conclusão não declara validação visual, acessibilidade, autenticação, integração real ou prontidão de publicação.

Escopo examinado: `ops/faisca/lab/astro.config.mjs`, `lab-policy.mjs`, `render-fragment.mjs`, `lazy-host.mjs`, componente `FaiscaLab.astro`, página `index.astro`, `ops/faisca/ui.mjs`, builder, template, estilos e testes relacionados. A revisão considera a candidata Comercial #450, SHA `d38a4fc353bdfa277c47df4a46872fcd1c96f2d1`, como base informada da aplicação.

## Constatações

- **Separação do site público:** a configuração própria aponta para uma árvore `src` de laboratório, diretório público independente e saída em `ops/faisca/output/astro`; não usa as páginas ou o `dist` públicos. A flag exige a string exata `1` na configuração e no componente. O perfil mantém operação pública, chamadas externas, efeitos e pós-venda autenticado desativados.
- **Leitura no build:** o caminho de origem é definido pela configuração confiável e usado pelo renderizador de build. Não há caminho de arquivo recebido do visitante. O builder verifica tamanho, SHA-256 e dimensões da imagem; o fragmento reutiliza a imagem incorporada e remove o script autônomo antes de o Astro montar seu próprio bundle.
- **Ativação sob demanda:** importar `ui.mjs` não inicia a conversa. O host usa importação dinâmica após ativação, agrupa ativações concorrentes e recusa montar quando desconectado. Versão e estado de vida impedem uma importação antiga de alterar uma ligação substituta; a falha mantém tentativa novamente disponível.
- **Ciclo de vida:** a UI mantém instâncias por raiz, recusa raízes aninhadas e configuração indevida, limpa timers e listeners no `destroy`, esvazia histórico/resumo e invalida callbacks pendentes. A análise do código encontrou referências de elementos limitadas à raiz, com ajuste de IDs e relações ARIA quando há colisão.
- **Fallback e saída:** texto editorial, navegação interna e orientações permanecem no HTML. Controles dependentes de JavaScript começam ocultos e só aparecem após instalação dos listeners. As respostas e seus títulos de fonte usam `textContent`; não há transporte, cookies ou storage implementados na UI examinada.
- **Significado da demonstração:** a interface continua identificando respostas locais, ausência de envio de contato e ausência de IA externa. A R02 não cria preço, pedido, lead, autenticação ou consulta a dados do cliente.

## Limitações e verificações pendentes

1. O navegador não foi executado por este revisor. O responsável pela rodada informou bloqueio ambiental do QA browser. Não foram comprovados aqui DOM real, foco, múltiplas instâncias no navegador, mudanças de rota, layout móvel, axe ou comportamento de CSP. Os doubles de `EventTarget` dos testes de host verificam contratos assíncronos; não substituem essas provas.
2. O build Astro e os testes Node informados pelo responsável não foram repetidos por este revisor. Seus resultados devem constar no relatório da rodada com seus logs próprios; este parecer não aumenta contagem de testes aprovados.
3. O CSS mantém seletores globais da demonstração. Isso é compatível com a página isolada examinada; antes de uso como widget no site público, será necessário isolar os estilos e revisar as interações com o layout hospedeiro.
4. Loopback, flag de build e `noindex` não são autenticação. O artefato estático não deve ser descrito como protegido por login nem como publicação autorizada. O HTML Astro não reutiliza a CSP inline do HTML autônomo, pois seus módulos e estilos são empacotados separadamente; a política do hospedeiro precisará ser conferida na etapa de implantação apropriada.
5. Este parecer não resolve o bloqueio anterior de publicação do mascote e documentos no GitHub público. Nenhum envio remoto foi tentado na auditoria.

## Referências para a continuação R03, sem implementação nesta revisão

Foram inspecionadas separadamente as candidatas Agents [#471](https://github.com/rafhael100/imagine-ai-agents/pull/471), SHA `740abafc813dbde70f5a2ad6e138402ed7945276`, e Central [#472](https://github.com/rafhael100/imagine-ai-agents/pull/472), SHA `8e7f1f21a2927bde3e337edaace0e1e6dffdc29a`. Não houve combinação ou alteração dessas branches.

O [AiSuggestionProvider](https://github.com/rafhael100/imagine-ai-agents/blob/740abafc813dbde70f5a2ad6e138402ed7945276/src/Contracts/AiSuggestionProvider.php) já separa sugestão de efeitos; o [MockAiOrAutomationRouter](https://github.com/rafhael100/imagine-ai-agents/blob/740abafc813dbde70f5a2ad6e138402ed7945276/src/MockOrchestration/MockAiOrAutomationRouter.php) distingue regra determinística de elegibilidade para modelo, sem executar ou gastar. A [reserva/conciliação PostgreSQL](https://github.com/rafhael100/imagine-ai-agents/blob/740abafc813dbde70f5a2ad6e138402ed7945276/tools/labs/PgAiCreditReservationLab.php) e o [gate de replay](https://github.com/rafhael100/imagine-ai-agents/blob/740abafc813dbde70f5a2ad6e138402ed7945276/tools/labs/PgSyntheticReplayGate.php) são estritamente de CI descartável.

Essas primitivas podem orientar um contrato de conversa e um adaptador sintético do Faísca. Não foi encontrada uma API de chat Faísca pronta nas candidatas inspecionadas. O receiver privado de eventos CRM da Central não é endpoint para navegador ou conversa. A continuidade deve preservar os contratos existentes e seus guards, sem transportar classes CI-only para a UI nem afirmar conexão real com IA, CRM ou pós-venda.
