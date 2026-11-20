# Faísca R119 — limpeza de sessão do navegador privado

Problema: um novo envio inválido podia manter na tela a resposta e a citação do teste anterior. Uma navegação com BFCache também podia reter o texto anterior e permitir a conclusão tardia de fetch apesar de o operador já ter saído da tela.

Correção: todo novo envio começa limpando a resposta e suas fontes anteriores; pagehide apaga token, pergunta, atestado, resposta e fontes, aborta a requisição em andamento e invalida a geração antiga. Promessas tardias não devem voltar a escrever respostas na tela. Nenhum retry automático nem modificação de site público.

Testes: `node --test tests/faisca-r119-private-browser-ephemeral-session.test.mjs` executa o JS exato em VM para envio inválido, pagehide e fetch que ignora cancelamento; CI Node, HTTP, Chromium/axe, Portal Onepage, PHP, PostgreSQL e Comercial/SEO devem ser conferidas na SHA exata.

Limites: abort pode não cancelar cobrança já iniciada no provedor; os gates duráveis no servidor continuam obrigatórios. Só perguntas e respostas sintéticas, sem dados reais. A R92 homologada segundo operador não demonstra que R119 está instalada. Sem GO público ou mudança em main, mascote, site, VPS/DNS/CRM/Portal. `publicFaiscaEnabled=false`.