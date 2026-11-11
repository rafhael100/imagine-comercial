# F161 — Instalação Chromium sem apt-get no CI, mantendo QA obrigatório

Em 11/11/2026, a integração RC33 [run #43033874579](https://github.com/rafhael100/imagine-comercial/actions/runs/43033874579) passou pelo Node/build/SEO, mas a etapa `playwright install --with-deps chromium` falhou por **DNS de mirror Ubuntu** (`azure.archive.ubuntu.com`), não por uma violação de código. O PostgreSQL da mesma PR passou.

Para reduzir dependência do gerenciador apt no GitHub-hosted `ubuntu-24.04`, esta entrega mantém `npm ci` travado e usa `npx playwright install chromium`, que instala a versão de navegador compatível com Playwright definida no lockfile **sem solicitar instalação adicional de bibliotecas apt**.

Isso **não pula QA**: os três scripts Chromium/axe existentes (site público compilado, prévia HTTP autenticada e prévia 7/7 do orçamento) continuam obrigatórios e sem `continue-on-error`. Se o runner não tiver bibliotecas do sistema suficientes, o teste deve falhar fechado e a configuração deve ser revista, não ignorada. É uma alteração de CI **somente em desenvolvimento**, sem mudanças no HTML publicado, `main`, DNS, Portal/CRM, pagamentos, produção ou custos.
