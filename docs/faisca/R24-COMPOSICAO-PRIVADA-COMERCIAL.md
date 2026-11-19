# Faísca R24 — composição do Comercial real com o Faísca em staging privado

**Base:** Faísca R23 [#486](https://github.com/rafhael100/imagine-comercial/pull/486).  
**Objetivo:** avançar do demonstrativo isolado para a **página Astro real do Imagine Comercial**, sem habilitar um widget público, checkout, IA externa, CRM ou autenticação de clientes.

## O problema que esta entrega resolve

A R22 fornece uma experiência de vendas e pós-venda navegável, mas em páginas independentes do site Comercial. Não comprova a interação entre o **HTML Astro real**, CTAs de serviços e o Faísca.

O Comercial já dispõe de `createPrivateLoopbackPreview` (F154): servidor de revisão autenticado por senha forte, exclusivamente em `127.0.0.1`, sem escrita nem serviços externos. A R24 reutiliza este controle para compor ambos os artefatos **na mesma origem e sob a mesma autenticação**, somente em uma sessão de revisão.

## Código entregue

1. `src/lib/private-loopback-preview.mjs`: extensão **opcional** `faiscaPrivateAssets`, obrigatoriamente um `Map` limitado de páginas e scripts revisados. Os novos caminhos autorizados são exclusivamente `/__faisca_preview/journey/`, `/__faisca_preview/support/` e arquivos JavaScript/CSS com nomes permitidos em `/_astro/`. O controle de origem, Basic Auth, métodos GET/HEAD, cabeçalhos NOINDEX, no-store e Content Security Policy permanecem os mesmos.
2. Ao servir a **homepage para um revisor autenticado**, o servidor insere uma seção estática com CTA **Conversar com o Faísca (teste privado)** antes do fechamento do `main`. A inserção acontece apenas **na resposta HTTP privada**: não altera `dist/index.html` em disco, nem `src/pages/index.astro` ou qualquer página pública de produção.
3. `ops/faisca/composition/commercial-preview.mjs`: exige o manifesto de hashes da R21/R22, carrega apenas as duas jornadas locais e os assets revisados, bloqueia colisão de nomes entre bundles Astro com conteúdo diferente e expõe o resultado via servidor F154. A rotina não inclui `/grounded/`, `/http/`, `/journey-http-r08/`, APIs, PHP, CRM, Portal ou checkout.
4. `tests/faisca-r24-private-composition.test.mjs`: contrata apenas dados sintéticos para provar integridade, autenticidade, recusa anônima, não escrita, ausência de links públicos e prevenção contra colisões/adulterações.
5. `ops/faisca/composition/browser-qa.mjs`: Chromium real percorre página Comercial → CTA Faísca → qualificação Onepage → comparação com fonte local → pós-venda anônimo. Também confere que o simulador de compra da página permanece disponível e **não** cria pagamento ou lead.

## Executar localmente

Requisitos: Node.js 22+, dependências do repositório instaladas e uma senha local forte **de pelo menos 24 caracteres**. Não colocar essa senha no chat, GitHub ou arquivos de versionamento.

No PowerShell, na raiz do checkout de revisão:

```powershell
npm ci --no-audit --no-fund
npm run build
$env:IMAGINE_FAISCA_LAB = '1'
npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/review/build-review.mjs --private-review
$env:IMAGINE_FAISCA_PRIVATE_PASSWORD = Read-Host 'Senha privada de revisão (24+ caracteres)'
node ops/faisca/composition/commercial-preview.mjs --private-review
```

O terminal indicará um endereço local no formato `http://127.0.0.1:<porta>/`. Ao abrir, o navegador solicitará usuário **`reviewer`** e a senha que você definiu. Na home verá o CTA especial do Faísca, com acesso às duas jornadas de revisão. Use somente mensagens fictícias.

O script não possui modo de bind público nem recebe destino de rede externo. Para encerrar use **Ctrl+C**, e remova a variável temporária da sessão PowerShell quando terminar.

## Verificações em CI

No workflow `Faísca — demonstração guiada e acessibilidade`, a R24 compila o **Astro Comercial** e executa a composição real após os gates da R21/R22. A execução navegável confirma origem única, proteção e preservação do simulador, além de inspecionar acessibilidade da entrada privada. Os testes normais SEO/build/navegador do Comercial continuam independentes.

O modo R24 permanece um teste de laboratório. O HTML comercial compilado público fica byte-identical; não há `main` atualizado, custo, DNS, VPS, usuário, lead ou pedido.

## Gates restantes até produção

- Revisão independente de segurança, privacidade e da composição de branches do Comercial.
- Plano de ativação/rollback de widget no Astro, compatível com navegação, SEO, acessibilidade, performance e idiomas.
- Provedor de IA generativa real (política LGPD, orçamento, limites, segredos em vault, segurança contra abuso, revisão editorial).
- Portal/CRM autenticados e operacionais, com idempotência, fontes de pagamento, entrega de briefing e recibos. O Portal [#941](https://github.com/rafhael100/imagine-portal/pull/941) comprova núcleo Onepage em laboratório PostgreSQL/Sites, **não um checkout real implantado**.
- Staging HTTPS protegido na Leaseweb, backup/restauração, revisão independente e GO explícito para publicação.

**R24 integra os artefatos reais em uma prévia privada de revisão; não significa que o Faísca foi publicado ou que um cliente já possa contratar pelo chat.**
