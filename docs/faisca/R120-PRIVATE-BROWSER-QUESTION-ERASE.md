# Faísca R120 — apagar a pergunta digitada antes de qualquer POST

Um texto rejeitado pelo preflight privado ainda permanecia no campo da página, embora não fosse enviado. Durante uma requisição válida, a pergunta fictícia também ficava no DOM até a resposta HTTP.

A R120 limpa o textarea e o atestado quando o token/seleção estão inválidos, quando a pergunta não passa no preflight e imediatamente antes de iniciar um POST aceito. O texto fictício fica apenas na variável local necessária à requisição; o servidor mantém o gate independente. A R119 já limpa respostas anteriores e invalida requisições ao sair da página.

Executar `node --test tests/faisca-r120-private-browser-question-erase.test.mjs` e CI Node/HTTP/Chromium/axe/SEO/Portal/PHP/PostgreSQL na SHA exata. Testes usam somente fixtures fictícias e servidor simulado. Não é prova de privacidade completa, de homologação na VPS ou de autorização de uso público. R92 já homologada conforme informado; R95+ requer homologação separada.

Sem merge, deploy, alteração de DNS/VPS, segredos, chamadas pagas, dados reais ou ações CRM/Portal. Mascote e site público preservados; `publicFaiscaEnabled=false`.