# F154 — Prévia HTTP autenticada estritamente local

**Estado:** funcional em desenvolvimento, **não é** staging privado Leaseweb e **não é** autenticação de produção.

## O que foi implementado

Servidor Node HTTP somente em `127.0.0.1`, sem opção de bind externo, login HTTP Basic com senha fornecida exclusivamente em variável de ambiente, comparação resistente a timing e rejeição de `Host` diferente para mitigar DNS rebinding. Permite **apenas GET/HEAD** das páginas públicas curadas e dos assets compilados Astro sob `/_astro/`. Nenhum diretório, arquivo arbitrário, token de query, path traversal, symlink ou método de escrita é servido.

Cada resposta, inclusive `401` e `404`, recebe `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: private, no-store`, CSP, `X-Frame-Options: DENY`, política de referrer e proteção cross-origin. Em vez de mostrar o `robots.txt` de produção, a prévia retorna `Disallow: /`; o sitemap fica indisponível. O HTML original do build não é alterado. Sem cookies, dados de clientes, logs de URL ou formulários ativos.

Para prévia **apenas na própria máquina**, depois de `npm run build`, defina uma senha aleatória de pelo menos 24 caracteres **fora do Git/repositório** na variável `IMAGINE_PREVIEW_PASSWORD` e execute `node scripts/start-private-loopback-preview.mjs`. Use usuário HTTP Basic `reviewer`. A porta padrão é `4808`, alterável por `IMAGINE_PREVIEW_PORT`. **Nunca** publique essa porta, use reverse proxy, exponha ao mundo, ou trate esse acesso HTTP de loopback como login de clientes. Para homologação remota é necessário serviço separado com HTTPS, IAM/MFA, rede privada, políticas e revisão.

## Critérios automáticos

- Teste Node com servidor HTTP real verifica login necessário, senha incorreta, GET/HEAD, rejeição POST, origem/Host, fuga de diretório, arquivos fora do catálogo, symlinks, CSP/noindex/no-store, robots e sitemap.
- Teste pós-build faz requisições reais para todas as rotas públicas e assets JS/CSS gerados, validando isolamento por autenticação e não indexação.
- O novo step de CI valida apenas ambiente descartável local, sem DNS, produção, Leaseweb, integração Portal/CRM ou envio de dados.

F70, endpoint seguro, identidade e RBAC, privacidade legal, retenção e revisões independentes continuam bloqueados.
