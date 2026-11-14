# P0 F161 — HTTP real no loopback para conferência de orçamento (CI)

**Entrega técnica:** servidor HTTP exclusivo de `tests/fixtures/private-budget-http-review-harness.mjs` com POST a `127.0.0.1`, porta aleatória, HTTP Basic com senha fictícia de teste, Origin/Host estritos, JSON de no máximo 4 KiB, headers no-store/noindex, negativa dos demais métodos/rotas e nenhuma escrita.

O consumidor executa o código real F159 (que reúne F157, envelope CRM F78, CAS F80 e gate F94). Um status 200 significa **somente inspeção sintética**, jamais recebimento no Portal ou no CRM. A resposta inclui apenas diagnóstico e flags de capacidade **sempre falsas**, sem nome, e-mail, mensagem, UUID, token, cookie ou recebimento durável.

**Testes:** `node --test tests/private-budget-http-review.test.mjs` e `npm test`. Cenários: autorização ausente, origem/host divergente, tipo de mídia, JSON inválido, excesso de corpo, estado obsoleto, contato inválido e resposta estrutural. Todos usando valores fictícios.

Não existe rota Astro, envio público, conta real, TLS público, PII real, persistência, staging ou deploy. Os requisitos F70/F94 e issue #56 seguem bloqueados.
