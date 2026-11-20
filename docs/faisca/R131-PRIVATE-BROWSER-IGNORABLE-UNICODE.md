# Faísca R131 — Unicode invisível em pré-envio e saída do navegador privado

## Falha reproduzível
A R117/R129 rejeitava listas específicas de caracteres invisíveis em perguntas, mas não incluía soft hyphen (U+00AD), BOM (U+FEFF), bidi isolate (U+2066), ZWJ (U+200D) e combining grapheme joiner (U+034F). A resposta no navegador filtrava URLs e falsas alegações operacionais, mas não rejeitava esses code points, permitindo apresentação ambígua de texto não confiável.

## Recorte implementado
O JS **exato da interface privada** rejeita `\\p{Default_Ignorable_Code_Point}` no preflight da pergunta fictícia **antes do POST** e na barreira de resposta **antes de `textContent`**. Tratamento é conservador (pode rejeitar algum texto Unicode legítimo) e exige reescrita explícita pelo operador; não remove caracteres silenciosamente nem altera regras de servidor.

Testes em `tests/faisca-r131-private-browser-ignorable-unicode.test.mjs` executam o JS real com DOM/HTTP simulados, cobrem cinco marcadores invisíveis, prova de não envio, limpeza de bearer/pergunta, recusa de alegação enganosa, ausência de retry e controles positivos de respostas editoriais limpas.

## Reprodução e limites
```bash
node --test tests/faisca-r131-private-browser-ignorable-unicode.test.mjs
npm test
npm run test:browser
```
Os checks de GitHub Actions (Node/HTTP/Chromium/axe, SEO/build, integração sintética Portal/Onepage, PHP e PostgreSQL temporário) são gates e **não** homologação privada da VPS. Aplicar e homologar a versão acumulada no staging apenas por operador autorizado; R92 concluída por relato e não deve ser repetida sem motivo. A proteção browser é secundária: o servidor deve falhar fechado independentemente dela.

Dependência: R130 #605 na SHA `82cce76507150d46738f7b2ebaf8a2566fb3657e`. PR draft isolada, sem merge nem deploy. Mascote, site público, `main` e `publicFaiscaEnabled=false` preservados; sem credenciais, API paga, dados reais, alterações VPS/DNS, CRM/Portal operacional, leads, tickets e cobranças. GO público continua bloqueado.
