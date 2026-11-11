# Comercial SEO-F163 — Container de homologação privado, isolado e sem publicação

Esta configuração prepara uma forma de executar o build Astro no servidor Leaseweb **somente depois que o administrador confirmar acesso e consentir com uma revisão de staging**. Ela não executa comandos Docker, não abre portas no servidor e não instala serviços automaticamente.

Os arquivos estão em `ops/staging/`:

- `compose.yaml`: exige imagem Nginx unprivileged **aprovada e fixada por digest** via `IMAGINE_STAGING_NGINX_IMAGE`, sem imagem padrão. Porta 4321 vinculada **apenas a 127.0.0.1**, sistema de arquivos read-only, processo UID 101, todas as capabilities removidas, `no-new-privileges`, limites de memória/PIDs e volumes de build somente-leitura.
- `nginx.conf`: entrega assets estáticos sem autoindexação, usa 404 customizada, impede métodos que não sejam GET/HEAD, restringe arquivos de configuração e aplica os quatro cabeçalhos defensivos F28, além de **`X-Robots-Tag: noindex, nofollow, noarchive`** e `Cache-Control: no-store` a todas as respostas, inclusive erros. O HTML do build conserva canonical de produção para a futura migração, mas a prévia é **proibida de ser indexada**; esses cabeçalhos não substituem isolamento de rede.

## Procedimento futuro para operador autorizado

1. **Não executar no servidor de produção nem reutilizar dados pessoais.** Preparar um workspace privado/contêiner isolado. Validar o código e o pacote com `npm ci --no-audit --no-fund`, `npm run build` e `node scripts/verify-dist.mjs` antes de copiar artefatos.
2. Selecionar e revisar independentemente um Nginx unprivileged compatível, **fixando a imagem pelo digest real**. Não se deve usar `latest`, tags mutáveis, digest inventado ou credenciais em Git.
3. Configurar `IMAGINE_STAGING_NGINX_IMAGE` no ambiente privado do operador e executar **primeiro** `IMAGINE_PRIVATE_STAGING_REVIEW=1 node scripts/check-private-staging-prerequisites.mjs`. O verificador F164 recusa tags mutáveis, digests de placeholder, build ausente e `_redirects` ou `_headers` no pacote público, mas **não** verifica assinatura/proveniência real da imagem; esta conferência independente é obrigatória. Somente depois usar `docker compose -f ops/staging/compose.yaml config` para revisar volumes e portas antes de **qualquer** inicialização.
4. Apenas com homologação autorizada, iniciar por `docker compose -f ops/staging/compose.yaml up -d --no-build`, verificando que só `127.0.0.1:4321` ficou exposto. Acesso remoto, quando necessário, somente via túnel SSH já autorizado.
5. Executar `IMAGINE_PRIVATE_STAGING_REVIEW=1 node scripts/review-private-staging-http.mjs --port=4321`. O relatório HTTP F161 deve conferir as quatro páginas e as 18 URLs em HOLD; resultados são revisão, nunca autorização de publicação. Encerrar o container após avaliação.

O Nginx do staging é um **servidor estático de avaliação**, não substitui o runtime final Cloudflare Workerd, nem os testes de assinatura e publicação do Portal/CRM. Faltam acesso Leaseweb, Docker disponível, imagem por digest auditada, revisão independente AppSec/DBA/LGPD, políticas de backup/TLS, permissões, migração e aprovação final de release.

**NO-GO:** nada foi colocado em execução nesta entrega. Sem deploy, DNS, redirects 301 reais, merge `main`, tokens ou novos gastos.
