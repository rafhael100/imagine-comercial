# Faísca R256 — CORS OPTIONS anônimo no staging privado

**REVIEW ONLY / NO-GO público.** A R252 e R255 verificam GET/HEAD,
mas uma resposta OPTIONS com CORS permissivo poderia divulgar um contrato
de origem cruzada mesmo quando GET anônimo devolve HTTP 401. A R256
acrescenta quatro **preflights OPTIONS sem autenticação**, com origem de
teste fixa e sem body, POST, cookies, bearer ou chave OpenAI.

Apenas no host 127.0.0.1, o módulo consulta quatro paths fixos do
Nginx privado, usando Origin https://synthetic-preflight.invalid e
Access-Control-Request-Method: POST. O cabeçalho é uma declaração
sintética, **não** uma requisição POST.

Cada resposta deve ser 401 ou 403, com os controles exatos de
Cache-Control, noindex, CSP, X-Frame-Options, no-sniff, Referrer-Policy e
Permissions-Policy. Qualquer status 2xx, 3xx, 404, CORS Access-Control-*,
cookie, redirect, Link ativo, relatórios de navegador ou resposta
excessiva é HOLD. A sonda impõe 2,5 segundos absolutos por solicitação,
8 KiB de headers e 2 KiB de corpo, sem seguir redirects.

O teste Node usa servidor HTTP sintético real, sem Docker, chave de
provedor ou conexão a serviços externos. O novo CLI
scripts/faisca-review-private-options.mjs exige
IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW=1, recusa CI, argumentos e URLs
e consulta apenas localhost:4337. Só um operador com autorização
operacional separada deve executá-lo em staging já existente.

**Limitações:** resultado positivo atesta somente quatro respostas
locais de OPTIONS naquele instante, não a autenticação, configuração
Docker efetiva, isolamento de rede, identidade de processo, proveniência
da imagem, faturamento de Luna/Terra nem instalação R95 na VPS. O HTTP
401/403 sozinho não demonstra que um navegador público não pode alcançar
outro endpoint. Exigir evidência independente da exposição de rede,
R255 e revisão de identidade antes de homologação privada.

Manter main, site público, mascote e publicFaiscaEnabled=false.
Sem merge/deploy, DNS/VPS, CRM/Portal/Sites, dados reais, compra, lead
ou ticket. AppSec/LGPD/FinOps/editorial e GO humano permanecem pendentes.
