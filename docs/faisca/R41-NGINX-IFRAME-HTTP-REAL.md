# Faísca R41 — correção verificada com Nginx real: iframe autenticado

**Base:** candidata unificada Comercial F357 + Faísca R38, [R39 #503](https://github.com/rafhael100/imagine-comercial/pull/503), **34/34 workflows verdes** na SHA `63be6b0c42d5a650a1d0621bb806277ba71c0348`. **Status:** PR draft, sem deploy/VPS/DNS.

## Defeito descoberto após a CI

O Nginx de staging da R38 usa `try_files $uri $uri/ $uri/index.html =404;` para servir a jornada Astro. O mapeamento de cabeçalhos de iframe era aplicado sobre `$uri`:

`map $uri $faisca_review_frame` e `map $uri $faisca_review_ancestors`.

Um GET autenticado para `/__faisca_preview/journey/` resulta em uma **reescrita interna** para `/__faisca_preview/journey/index.html`. O Nginx então reavalia `$uri` com o caminho final, que não corresponde ao padrão `/journey/$`. O resultado efetivamente servido é **HTTP 200, mas `X-Frame-Options: DENY` e `frame-ancestors 'none'`**, impedindo o uso da conversa embutida na homepage do Comercial.

Isso **não** foi detectado pela auditoria estática de hashes. A R38 passou em CI, mas o pacote original R38 baixado antes desta correção **não deve ser considerado homologado para a experiência de iframe Nginx**.

## Correção R41

- `ops/faisca/staging/nginx.conf`: os dois `map` usam agora **`$request_uri`** (a URL original que o visitante solicitou), não `$uri` (caminho mutável por `try_files`). O padrão aceita apenas `/__faisca_preview/journey/` e `/__faisca_preview/support/` sem query. Toda outra rota, inclusive homepage e URLs de jornada com query, mantém `DENY` / `frame-ancestors 'none'`.
- `ops/faisca/staging/verify-kit.mjs`: exige esses dois mapas por `$request_uri` e recusa os antigos mapas `$uri`, mesmo se alguém recalcular os hashes do manifesto. Continua exigindo autenticação, NOINDEX, bloqueio de escrita e CSP sem rede.
- `tests/faisca-r38-private-staging-kit.test.mjs`: prova de regressão negativa com Nginx trocado de volta para `$uri` e manifesto completamente recalculado; o kit ainda deve ser recusado por política.
- `tests/faisca-r41-nginx-frame-policy.test.mjs`: prova de fonte para os dois mapas, cabeçalhos de frame/CSP, autenticação, GET/HEAD e loopback do Compose.
- `ops/faisca/staging/check-nginx-loopback.py`: **ensaio de HTTP real** que inicia um Nginx temporário em `127.0.0.1` com senha bcrypt exclusivamente sintética, verifica o manifesto e realiza 11 requisições anônimas e autenticadas, encerrando o processo e removendo a área temporária ao final. Não conecta Docker, VPS, Cloudflare, PHP, CRM ou Portal.

## Evidência executada com Nginx real

No container temporário desta revisão, com Nginx **1.26.3**, a configuração R38 originalmente baixada passou em `nginx -t`, mas falhou no teste de enquadramento da página autenticada: **8/9 verificações aprovadas**, com `X-Frame-Options=DENY` onde deveria ser `SAMEORIGIN`.

Depois de aplicar exclusivamente a substituição dos dois mapas `$uri → $request_uri` em **uma cópia temporária** do kit R38 e atualizar o hash desse arquivo em manifesto de ensaio, a prova com Nginx local chegou a **11/11 verificações aprovadas**:

- 401 anônimo na homepage e jornada;
- 200 autenticado na homepage, jornada, suporte, script e robots;
- `DENY` no HTML da homepage;
- `SAMEORIGIN` e `frame-ancestors 'self'` nas duas jornadas privadas autenticadas;
- query inesperada na jornada volta a `DENY`;
- método POST recusado com HTTP 403;
- arquivo de configuração não servido (404);
- HEAD autenticado funciona sem corpo;
- cabeçalhos NOINDEX e CSP sem `connect-src` ou `form-action` de rede.

**Importante:** essa observação é uma prova com Nginx real **somente em localhost e um kit corrigido temporariamente**; o artifact oficial R41 deve ser gerado pela CI e sua versão exata verificada depois. Não é prova de Nginx em execução na Leaseweb, TLS, IAM/MFA, backup/restauração ou publicação.

## Reproduzir a prova local

Após baixar **o kit corrigido da CI R41** e verificar a origem pela SHA da PR, com Nginx e `htpasswd` previamente disponíveis em ambiente de laboratório isolado, execute:

```bash
python3 ops/faisca/staging/check-nginx-loopback.py --kit /caminho/para/kit-extraido
```

O script gera senha bcrypt sintética descartável, testa apenas `127.0.0.1`, recusa manifests/arquivos alterados e encerra o processo Nginx iniciado por ele. A CI compila o script e, **quando ambas as ferramentas já existem no runner**, executa o smoke; caso contrário, registra HOLD para o teste Nginx vivo e executa obrigatoriamente as regressões de política/Node/Chromium.

Para staging Leaseweb real, exigir operador autorizado, imagem Nginx por digest validado, bcrypt externo com UID/GID 101 capaz de lê-lo, Compose interpolado e configuração ativa revisados, túnel seguro/HTTPS/IAM, backups e rollback, sem usar a senha sintética desse teste. Nenhuma parte desta correção ativa deploy ou altera a `main`.

**Sem custos, cliente real, chaves, PSP, LLM externo, DNS/VPS ou alteração do mascote aprovado.**
