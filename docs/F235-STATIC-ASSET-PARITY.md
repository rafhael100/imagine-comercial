# F235 — Paridade de assets servidos pelo staging privado (NO-GO)

Após F234, o diagnóstico único verificava HTML de todas as páginas e as 27 respostas 404 contra os arquivos pinados. F235 estende a prova aos **arquivos estáticos não HTML** de `dist`: folhas de estilo, scripts, imagens, fontes, `robots.txt` e `sitemap.xml`.

## Teste operacional

- Reutiliza o inventário binário `readProtectedDist` com limites de até 500 arquivos e 50 MiB no pacote inteiro, sem symlinks, nomes inseguros ou fontes externas. A verificação HTTP extra é limitada a 100 arquivos não HTML de até 10 MiB por resposta.
- Antes de qualquer requisição autenticada, exige HTTP 401, `noindex` e `no-store` sem credenciais nos endereços dos assets.
- Verifica cada arquivo com Basic Auth, HTTP 200, cabeçalhos de segurança e privacidade, ausência de `Set-Cookie` e igualdade binária dos bytes da resposta com `dist` (sem logar corpos nem nomes privados).
- Exige `robots.txt` e `sitemap.xml` no conjunto pinado. Nenhum asset com divergência, falha de autenticação, 3xx ou status inesperado pode produzir relatório positivo.
- O relatório só inclui `servedStaticAssetsMatchPinnedBuild:true` e a quantidade de arquivos conferidos após a comparação integral. Nunca autoriza deploy, DNS, 301 ou conexão real Portal/CRM.

Limitação: é uma conferência por HTTP de loopback contra uma prévia previamente iniciada e autorizada pelo operador. O resultado não valida o TLS externo, a identidade do servidor, a procedência da imagem Docker, as permissões reais da VPS, Core Web Vitals de campo ou migração SEO. Não executar contra produção.
