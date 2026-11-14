# Imagine Comercial — F317: ensaio HTTP de migração gradual sem acessar o domínio

## Objetivo

Verificar a política F314 **contra requisições HTTP reais, mas totalmente
locais e descartáveis**. Uma verificação estática de 62 rotas novas e 27
rotas históricas não comprova que métodos POST, arquivos CSS/JS e
respostas da home permaneceriam corretos quando atendidos por um roteador.

O script de CI `scripts/test-progressive-legacy-overlay-http-ci.mjs`
executa dois servidores HTTP temporários, **ambos vinculados a
`127.0.0.1` em portas aleatórias**:

- **Legado sintético:** responde apenas com marcadores fixos de
  laboratório e reconhece GET, HEAD, POST, PUT, PATCH, DELETE e OPTIONS.
  Não guarda, recebe ou processa contatos reais.
- **Sobreposição simulada:** consulta a política F314, serve arquivos
  `dist/` do Astro real quando a rota está na lista assinada por
  manifesto SHA-256, ou reencaminha por HTTP local para o servidor
  sintético. Nenhuma origem de produção é consultada.

## Invariantes testadas

1. A home antiga `/` continua no legado fictício;
2. Outras **62 rotas Astro** respondem com os bytes exatos do build;
3. As **27 URLs históricas**, incluindo 22 HOLD e 5 candidatas a
   redirecionamento, permanecem no legado de laboratório, sem 301;
4. O antigo `robots.txt`, `sitemap.xml`, `/fale-conosco.html`
   e caminhos desconhecidos continuam no legado;
5. Todo CSS, JavaScript e logo revisados são servidos byte a byte;
6. Toda ação POST/PUT/PATCH/DELETE/OPTIONS segue para o legado, não
   para o novo site estático; um corpo sintético comprova continuidade;
7. HEAD não envia corpo de resposta, e todas as respostas da simulação
   têm `X-Robots-Tag: noindex`, `Cache-Control: no-store` e
   identificação de laboratório;
8. A execução escreve somente
   `REVIEW-ONLY-synthetic-overlay-http.json` no artifact de CI,
   que contém contagens, hashes do build e flags explícitas NO-GO.

## Limitações decisivas

O teste NÃO prova que o servidor legado real ainda recebe formulários
ou que a Leaseweb, Cloudflare, DNS ou HTTPS estão configurados. Tampouco
verifica CSRF, disponibilidade operacional, política de cookies em
origens distintas, autenticação, SEO `hreflang` recíproco nem
reversão de produção.

Este é apenas o ensaio do **algoritmo**, não um proxy para instalar
no domínio. Quando a infraestrutura estiver disponível, o operador
deve confrontar estas evidências com uma homologação
protegida por senha, backups, restauração, formulários de teste
de ponta a ponta, GSC real e segurança.

**DRAFT / NO-MERGE / NO-DEPLOY / NO-LIVE-LEADS /
NO-DNS / NO-301 / NO-CHARGE.**
