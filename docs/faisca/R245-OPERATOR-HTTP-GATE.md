# Faísca R245 — isolamento HTTP de alegações sobre a Imagine (DRAFT)

A R244 impede que perguntas fictícias mencionando Imagine, Faísca ou “vocês”, fora das receitas verificadas de preço/processo, sejam enviadas aos modelos para inventar respostas em nome da empresa. A R245 testa o **servidor HTTP real de laboratório**, não apenas a função de classificação.

- Servidor privado `127.0.0.1` iniciado com adaptador totalmente sintético, três POSTs com confirmação fictícia e token de teste específico.
- Cada resposta deve conter o texto editorial determinístico, sem fontes, modelos, efeito operacional, eco da pergunta ou permissão pública.
- Um adaptador mal configurado que tenta devolver `general_answer` e inventar disponibilidade em nome da Imagine é bloqueado pelo HTTP com 503 genérico, sem eco.
- `node --test tests/faisca-r245-operator-http-review.test.mjs`. Revalidar Node/HTTP, Chromium/axe, SEO/build, Portal/Onepage, PG descartável e agentes PHP na HEAD exata.

Nenhuma credencial real, chamada paga, mensagem de cliente ou integração operacional é usada. R95–R245 não são presumidos na VPS. A R92 e os testes privados reais de Luna/Terra anteriormente relatados não foram repetidos. Ainda faltam identificação independente do staging implantado, verificação de gastos reais e revisões editoriais/AppSec/LGPD/FinOps. PR draft isolada, `main` e `publicFaiscaEnabled=false` preservados; **NO-GO público**.
