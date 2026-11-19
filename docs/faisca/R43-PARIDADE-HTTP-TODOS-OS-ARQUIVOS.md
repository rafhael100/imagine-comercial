# Faísca R43 — Nginx deve servir TODOS os bytes aprovados pelo manifesto

**Base:** [R42 #506](https://github.com/rafhael100/imagine-comercial/pull/506), com R41 Nginx corrigido e a candidata Comercial F357 + Faísca R38 unificada. **Escopo:** localhost de laboratório, sem VPS, DNS ou deploy.

## Por que avançar

A R41 confirmou com Nginx real que a configuração corrigida permite autenticação e carregamento do Faísca embutido: **11/11 verificações HTTP**. Isso resolve o defeito de CSP/X-Frame-Options causado pelo `try_files` e pelo antigo `$uri`.

Contudo, 200 OK numa página não comprova **que todos os demais assets e páginas estejam realmente sendo servidos na versão aprovada**. Um staging poderia servir um script antigo, um HTML do Comercial desatualizado, uma rota errada ou um asset substituído, mesmo com a configuração protegida e o manifesto do ZIP válido.

## Entrega executável

`ops/faisca/staging/check-nginx-loopback.py` acrescenta uma segunda etapa ao smoke R41:

1. Valida previamente todos os arquivos do kit, contra o manifesto `Faisca_R38_MANIFEST.json`, e verifica que o status é `REVIEW_ONLY_NO_DEPLOY`.
2. Inicia apenas um Nginx **temporário e local em 127.0.0.1**, com credencial bcrypt *sintética* gerada para o teste, sem alterar o kit fonte.
3. Repete os onze testes R41 de autenticação, XFO/CSP, 401/200/403/404/HEAD e query com `DENY`.
4. Identifica **cada** entrada do manifesto com caminho `site/` e converte o caminho físico para a URL pública correspondente. Exemplos: `site/index.html → /`, `site/en/index.html → /en/`, `site/__faisca_preview/journey/index.html → /__faisca_preview/journey/`, `site/_astro/arquivo.js → /_astro/arquivo.js`. Para `site/404.html`, usa uma URL inexistente, verificando o corpo 404 real.
5. Busca a URL com Basic Auth e exige código HTTP correto, header `noindex`, **ausência de `Set-Cookie`** e **hash SHA-256 e quantidade de bytes idênticos** à entrada da fonte revisada. O primeiro desvio impede a aprovação.
6. Encerra o processo e apaga a área temporária; nenhum arquivo do ZIP original, repositório, Portal, CRM, VPS ou DNS é modificado.

## Prova já realizada

Sobre o **artifact oficial R41** [R41 — PR #505](https://github.com/rafhael100/imagine-comercial/pull/505), contendo 115 arquivos no manifesto (incluindo os operacionais do próprio kit) e 111 entradas `site/`, a verificação local com Nginx real passou:

- **11/11** requisições de autenticação, enquadramento e bloqueio;
- **111/111** arquivos de site servidos via HTTP autenticado com corpo **byte-idêntico** aos hashes SHA-256 revisados;
- **zero** divergências de rota, tamanho ou conteúdo;
- processo Nginx local encerrado ao concluir.

Esses números representam **localhost com o artifact de revisão**, não a versão efetivamente servida pela Leaseweb.

## CI e operação

O workflow Faísca já contém uma etapa de Nginx em `127.0.0.1` quando `nginx` e `htpasswd` estiverem disponíveis no runner. A R43 estende a mesma etapa: agora ela precisa passar também na lista **integral de assets**. O código Python sempre passa por `py_compile`; a CI **não instala Nginx nem usa Docker**. Se as ferramentas não existirem, o teste real é explicitamente marcado como HOLD e a revisão do operador continua obrigatória.

Para reproduzir em laboratório, com a versão exata e aprovada do kit extraída:

```bash
python3 ops/faisca/staging/check-nginx-loopback.py --kit /caminho/do/kit-extraido
```

Não reutilizar uma senha verdadeira nesse smoke. Em staging operacional, são necessários login/bcrypt privados de operador, imagem auditada por digest, IAM/MFA, acesso restrito, TLS/túnel, backup/restauração e rollback. **A CI verde não concede autorização de GO nem realiza deploy.**

O release público do Faísca continua bloqueado: sem IA generativa externa, pedido Portal/CRM autenticado, preço/contrato/PSP e autorização separada, a conversa é somente de laboratório.

**Sem merge na main, alterações da VPS/DNS, custos, dados de clientes, PSP, CRM ou alteração do PNG aprovado do mascote.**
