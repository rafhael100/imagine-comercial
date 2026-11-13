# F292 — HEAD protegido e métodos de escrita proibidos no staging privado

A verificação de GET e dos bytes entregues (F159/F167/F258) **não demonstra sozinha** que o servidor privado bloqueia métodos não previstos. O Nginx revisado contém `limit_except GET HEAD { deny all; }`; esta etapa confronta esse comportamento com HTTP real no loopback.

## O que é verificado

O operador autorizado, com staging **já iniciado** e credencial privada disponível apenas no ambiente de trabalho, executa:

```bash
IMAGINE_PRIVATE_STAGING_REVIEW=1 node scripts/check-private-staging-methods.mjs --port=4321
```

O comando usa exclusivamente `127.0.0.1:4321` e exige `IMAGINE_STAGING_REVIEW_PASSWORD` fornecida fora de Git. Faz **24 requisições de leitura/controle**, sempre sem corpo enviado pelo cliente:

- **6 HEAD anônimos:** home, contato, robots, sitemap, 1 rota antiga HOLD e 1 candidata. Todos precisam responder 401 com desafio Basic e sem corpo.
- **6 HEAD autenticados:** 200 para rotas atuais/SEO, 404 para rotas legadas; MIME adequado e corpo ausente.
- **12 testes autenticados com métodos proibidos:** POST, PUT, DELETE e OPTIONS na home, no contato e em uma rota legada HOLD. Todos devem retornar 403 ou 405.

Todas as respostas exigem cabeçalhos de segurança revisados, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store` e ausência de cookies, redirect e liberação CORS. A saída relata **somente contagens fixas**, sem revelar URL, senha, headers recebidos, corpo, IP externo ou caminhos privados. Nenhuma requisição tem payload, endpoint de CRM, upload ou domínio público.

## Inclusão no comando único de homologação

A F292 torna-se a quinta etapa de `IMAGINE_PRIVATE_STAGING_REVIEW=1 node scripts/review-private-staging-chain.mjs`, depois de:

1. configuração/pacote privado e pin independente (F164/F165);
2. contêiner real em execução, portas, mounts e limites (F256);
3. configuração Nginx efetivamente carregada (F257);
4. GET autenticado/anônimo, HTML/assets e 27 rotas antigas (F167/F232–F236).

**Se a etapa de métodos falhar, o conjunto inteiro permanece HOLD.** Um resultado positivo confirma apenas o comportamento HTTP observado naquele instante: não valida TLS remoto, SSH/firewall, origem real da imagem, consentimento LGPD, integração Portal→CRM, disponibilidade do host público, equivalência SEO nem aprovação de lançamento.

## Evidência e limitações

Os testes do GitHub exercitam simulações adversariais e um servidor HTTP Node efêmero em `127.0.0.1`, **não o Nginx da VPS Leaseweb**. A execução real depende de acesso e autorização operacional independentes; nunca executar comandos de deploy, mudar DNS, publicar 301, fazer merge na `main` ou usar dados reais por causa deste relatório.

**Estado de produção: NO-GO.**
