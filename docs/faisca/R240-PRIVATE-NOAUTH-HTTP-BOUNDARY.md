# Faísca R240 — conferência HTTP somente leitura, sem autenticação

## Contexto

Os auditores R229–R239 validam configuração Nginx, Compose, Docker e a identidade local de uma imagem fornecida. Isso não verifica o comportamento HTTP: um serviço que respondesse 200/302 sem autenticação, relaxasse CSP ou emitisse cookies ainda exigiria detecção independente.

## Incremento

- ops/faisca/staging/review-private-http-boundary.mjs: sonda de leitura somente para 127.0.0.1, porta 4337 por padrão; nunca resolve DNS, nunca usa HTTPS externo, autenticação ou cookies. Executa quatro GET e um HEAD serializados em caminhos fixos do staging. Exige HTTP 401, desafio Basic da revisão Imagine, proteção contra indexação/cache, CSP e X-Frame-Options condizentes com a rota, segurança de MIME/referrer/permissões e ausência de Set-Cookie, Location e CORS permissivo. Resposta com mais de 8 KiB e timeout são HOLD.
- tests/faisca-r240-private-loopback-http.test.mjs: servidor HTTP sintético em porta efêmera local; testa as cinco sondas, headers e métodos sem credenciais, exposições 200/302, relaxamento de CSP, cookies, redirecionamentos, duplicações e indisponibilidade.

Comando: node --test tests/faisca-r240-private-loopback-http.test.mjs. Validar também suíte Node/HTTP, Chromium/axe, SEO/build, PHP, Portal/Onepage e PostgreSQL descartável na HEAD exata.

## Limites

Nenhuma sonda foi enviada à VPS. A função só executa HTTP quando invocada; a CI a executa exclusivamente contra servidor sintético em 127.0.0.1. O teste operacional privado exige operador previamente autorizado e não confere identidade da VPS, firewall, exposição real, configuração nginx -T, login válido, sessão, respostas Luna/Terra, qualidade editorial ou gastos. Não usa dados reais, chave ou usuário de serviço.

Os testes pagos Luna/Terra e a homologação R92 previamente relatados não são repetidos. R95–R240 não presumidos instalados. Manter as revisões AppSec/LGPD/FinOps/editorial e evidências privadas de procedência, autenticação, consumo, HTTP e Portal/Sites como HOLD. Sem merge/deploy/VPS/DNS/CRM/Portal/Sites operacionais, leads, tickets ou cobrança; main, site, mascote e publicFaiscaEnabled=false preservados. **NO-GO público.**
