# F174 — Comparação interativa de até duas soluções

## Funcionalidade real no site comercial

A página pública `/comparar-solucoes/` já apresenta os seis serviços aprovados, separados em presença digital e mídia. Agora o visitante poderá clicar em **Adicionar à comparação** em até duas soluções, mesmo que estejam em grupos diferentes. Uma área de comparação apresenta os critérios aprovados de cada escolha lado a lado, com links reais para informações e para contato.

Ao selecionar duas, as outras opções ficam temporariamente indisponíveis, mas podem voltar a ser selecionadas assim que o visitante remover uma das escolhas. Os controles usam `aria-pressed`, rótulos dinâmicos e contador `role=status`. Não há preço, pontuação automática, elegibilidade, previsão de resultado ou recomendação inferida.

Todos os textos, slugs e links são obtidos do catálogo já revisado `src/data/service-comparison.mjs`. A interface usa `textContent` e construção de elementos DOM, nunca `innerHTML` ou texto livre do visitante. Não existe formulário, rede, autenticação, analytics ou armazenamento; as escolhas desaparecem ao recarregar. Os seis cartões originais e seus links permanecem disponíveis sem JavaScript; os controles adicionais ficam ocultos.

A CI Node valida a cobertura de catálogo e o contrato seguro. O Playwright mobile/desktop verifica selecionar, limitar a dois, reabrir opção, remover, conferir links públicos, e fallback sem JavaScript. O escopo e os valores oficiais continuam definidos somente por proposta comercial. Nenhuma modificação na main ou produção.
