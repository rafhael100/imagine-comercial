# F171 — Staging: cabeçalhos de privacidade também após autenticação

A proteção F168 comprovava **26 respostas 401 anônimas** antes de autorizar a sequência de **22 GETs autenticados**. A F171 reforça a última etapa: até uma resposta 200/404 **depois de fornecer a senha** deve continuar não indexável e sem cache, sem cookies.

No módulo `src/lib/private-staging-http-gate.mjs` a política de cabeçalhos do staging requer os tokens exatos `noindex`, `nofollow` em `X-Robots-Tag` e `no-store` em `Cache-Control`. O parser separa diretivas por vírgula, ignora maiúsculas/minúsculas e recusa falsos positivos como `almost-noindex`, `no-storeX` ou apenas `noindex`. Um `Set-Cookie` em qualquer resposta da prévia autenticada ou anônima também bloqueia o diagnóstico. Os headers F28 anteriores continuam obrigatórios.

O código aplica a política apenas quando a revisão **privada com Basic Auth** foi explicitamente solicitada. A simulação Workerd sem autenticação mantém seu contrato separado, pois não deve ser confundida com staging protegido.

**Teste novo:** 26 solicitações sem senha + 22 com senha válidas, seguido de 14 cenários de sabotagem de cabeçalhos para páginas públicas e URLs em HOLD, e 4 cenários de respostas 401 inseguras. A ordem assegura que vazamentos anônimos falhem antes de qualquer requisição autenticada. Não há serviço remoto, senha real, dados de visitante, contêiner iniciado nem deploy.

O cabeçalho noindex não substitui segurança de rede e autenticação. Mesmo com aprovação do laboratório, são necessárias identidade/MFA, TLS/túnel SSH, verificação da imagem real, execução e revisão independentes do contêiner, integração Portal/CRM e decisão formal de produção.
