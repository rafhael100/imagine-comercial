# Imagine Comercial SEO RC37 — Staging privado em contêiner (configuração de laboratório)

A RC37 consolida RC36 e as entregas técnicas de infraestrutura:

**F163:** configuração para staging privado Leaseweb. O arquivo ops/staging/compose.yaml exige imagem fornecida pelo operador, porta somente 127.0.0.1:4321, processo não privilegiado, volumes somente-leitura, cap-drop, limites de recursos e Nginx estático com 404 customizada, métodos GET/HEAD e cabeçalhos F28. Nenhuma inicialização foi realizada.

**F164:** pré-teste de imagem que exige Nginx unprivileged por referência @sha256 (sem aceitar tags mutáveis, repositório alterado ou digest repetitivo de exemplo) e confere arquivos mínimos do build, sem regras _redirects e _headers publicáveis. Diagnóstico offline, sem Docker, tokens, rede, SSH ou deploy. Não substitui verificação independente de assinatura/proveniência e vulnerabilidades.

Evidências anteriores:
- [RC36 SEO/build/navegador — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43036004754)
- [RC36 PostgreSQL efêmero — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43036004745)
- [RC36 Workerd local — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43036004594)
- [RC36 Lighthouse local — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43036004542)
- [F163 SEO/build/navegador — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43036517242)
- [F163 PostgreSQL — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43036517447)

A RC37 tem CI próprio. Os testes individuais da F164 estavam pendentes na preparação deste documento e devem ser concluídos antes de qualquer aprovação técnica.

**NO-GO operacional:** acesso autorizado à VPS Leaseweb, contêiner isolado e TLS, imagem de fato assinada/auditada, permissões Portal/CRM, revisão AppSec/DBA/LGPD, inventário de URLs e migração, aceite comercial, rollback e aprovação de publicação. Nenhum container iniciado, porta pública aberta, merge main, DNS ou redirect 301 real.