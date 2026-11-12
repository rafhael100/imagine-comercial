# F226 — Auditoria offline do host canônico no staging

Esta etapa acrescenta o contrato puro `reviewCanonicalStagingEvidence`. Ele recebe quatro observações **fornecidas pelo operador** e analisa somente a raiz `/` das quatro variantes do domínio, com a decisão sem `www` da F225. **Não faz HTTP e não autentica a origem das evidências.**

## Contrato desejado
- `https://imaginecomunicacao.com.br/`: HTTP 200, sem Location, evidência TLS válida.
- `https://www.imaginecomunicacao.com.br/`: HTTP 301, Location exato para raiz HTTPS sem www, TLS válido.
- `http://imaginecomunicacao.com.br/`: HTTP 301 para raiz HTTPS sem www.
- `http://www.imaginecomunicacao.com.br/`: HTTP 301 para raiz HTTPS sem www.

O objeto de revisão obriga `productionAuthorized:false`, `dnsChangeAuthorized:false` e `redirectRulesAuthorized:0`, inclusive quando todos os testes simulados passam. O teste de redirecionamento nesta etapa **não cria regras**.

## Operação futura
Inspecionar com ferramenta autorizada e ambiente privado os headers/status/TLS reais do staging, com host e rede isolados. Nunca transportar cookies, autenticação, queries privadas ou dados reais ao GitHub. Testar caminhos publicados, históricos HOLD, query strings, ausência de loops e rollback em protocolo operacional separado.

A política de redirecionamento real de URLs históricas continua pendente da equivalência URL a URL, revisão SEO, Search Console, AppSec/LGPD e aceite formal de publicação. CI com amostras sintéticas não homologa a Leaseweb.
