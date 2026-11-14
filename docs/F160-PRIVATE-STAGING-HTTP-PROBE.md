# F160 — Diagnóstico HTTPS da futura homologação privada (sem deploy)

Criado um **pré-voo operacional de somente leitura** para o gate Leaseweb [issue #56](https://github.com/rafhael100/imagine-comercial/issues/56). O módulo `src/lib/private-staging-http-probe.mjs` valida evidências HTTP mínimas de acesso privado para a homepage, `robots.txt` e uma página inexistente, sem aceitar `HTTP 200` público na homepage, redirects, ausência de `X-Robots-Tag: noindex,nofollow` ou `Cache-Control: no-store`.

Apenas um **operador habilitado** poderá executar o CLI `scripts/probe-private-staging-operator.mjs` em ambiente próprio, **depois** que existir um subdomínio staging sob `imaginecomunicacao.com.br`, de configuração legítima. Requer `--origin=https://staging.imaginecomunicacao.com.br/` e variável `IMAGINE_STAGING_OWNER_ACK=STAGING_DIAGNOSTIC_ONLY`. As requisições são exclusivamente GET, não autenticadas, com timeout curto e redirects não seguidos. O CLI recusa execução dentro do GitHub Actions. Não coleta corpos de página, headers sensíveis, dados reais, usuário, senha ou cookie; seu relatório só contém códigos HTTP e sinais de segurança.

Em CI só rodam testes **puramente sintéticos** do parser/política, com casos adversariais para produção, domínio parecido, URL contendo token, porta, userinfo, falta de proteção e status errado. Não existe nenhuma chamada real à Leaseweb, DNS nem servidor neste PR.

**Limitações:** nem resposta 401/403 nem header noindex provam TLS válido, autenticação/MFA, concessão de papéis, restrição de rede, dependências Portal/CRM, auditoria de segurança ou autorização de release. Estes gates continuam bloqueados até homologação e revisão independente. Não executar esse CLI em produção.
