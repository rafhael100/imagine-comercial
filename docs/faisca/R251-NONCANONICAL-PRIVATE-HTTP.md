# Faísca R251 — URI não canônica sem bypass de autenticação

## Risco abordado

R250 verificou aliases e parâmetros sintéticos, mas não testou URI original codificada nem barras duplicadas. Proxy reverso e servidor estático podem normalizar esses caminhos de forma diferente antes de servir um arquivo. O nginx.conf privado configura X-Frame-Options e frame-ancestors usando $request_uri, e apenas as duas rotas canônicas de journey/support podem usar SAMEORIGIN. Variantes GET/HEAD não canônicas precisam continuar com 401, Basic, noindex, no-store, DENY e CSP frame-ancestors 'none'.

## Entrega executável

- reviewFaiscaPrivateNoAuthCanonicalization executa oito requisições fixas a 127.0.0.1, nunca a URL arbitrária: escapes percentuais de caracteres não reservados, barras duplicadas, query fictícia e HEAD direto.
- Reutiliza o auditor R240–R249 (prazo absoluto 2,5s por chamada, limite de 8 KiB cabeçalhos e 2 KiB corpo, rejeição de conteúdo pessoal/ativo e cabeçalhos que causam rede externa).
- Nenhuma requisição envia credencial, cookie, Origin, corpo, segredo ou dado real. A sonda não permite customizar caminho, método ou host; apenas uma porta TCP local para fixture descartável ou revisão privada.
- Teste: node --test tests/faisca-r251-private-noncanonical-http.test.mjs; cobre aprovação sintética, bypass 200 em uma URI, 301 de normalização, SAMEORIGIN indevido, CSP fraca, corpo ativo e parâmetros inválidos.

## Limites / gates

Essa checagem é read-only e NO-GO. Não executa Docker, não obtém provas de identidade de contêiner, não verifica autenticidade da origem da imagem, não usa API paga, não valida sessão autenticada e não comprova o staging VPS. No ambiente real, 401 sem autenticação também não prova ausência de exposição de porta externa: rede/iptables requer auditoria separada. Operador deve executar apenas após verificar a identidade do checkout e o destino loopback.

Base fixa R250 #729 0a29d3f9d8b532ec87dcddecfaf3a8d389e85833. PR draft, sem merge/deploy, alterações VPS/DNS, CRM/Portal/Sites operacional ou dados reais. Preservar main, mascote, site público e publicFaiscaEnabled=false. Respeitar o teste Luna/Terra pago e a homologação R92 já relatados. Permanecem pendentes o pacote acumulado R95–R251 na VPS e revisões AppSec/LGPD/FinOps/editorial; não há GO público.
