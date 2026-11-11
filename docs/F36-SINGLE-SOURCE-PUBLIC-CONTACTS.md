# F36 — Catálogo único de canais de atendimento (sem captação)

Data: 09/11/2026. Apenas código Astro, testes e QA local. **Nenhum envio, cadastro ou API CRM.**

## Problema de manutenção corrigido
O site Comercial já exibia telefone, WhatsApp e e-mail do site legado, e a auditoria F32 tinha uma segunda cópia desses valores. Isso permitia que uma edição de contato alterasse um dos destinos sem atualizar as verificações dos demais canais. A F36 cria `src/data/contact-channels.mjs`, uma fonte única de endereços públicos e funções de formação de URLs, consumida tanto pela página de contato como pela auditoria de links.

## Fonte pública e estado
Os valores foram observados por consulta ao site oficial anterior em 09/11/2026:
- Telefone: (85) 3032-9525; link `tel:+558530329525`.
- WhatsApp: (85) 9 9663-2689; URL `https://wa.me/5585996632689`.
- E-mail: `imagine@imaginecomunicacao.com.br`.

Fonte: <https://www.imaginecomunicacao.com.br/fale-conosco.html> e rodapé do site oficial <https://www.imaginecomunicacao.com.br/>.

**Consulta histórica não prova que as linhas estão ativas.** O lançamento depende de confirmação operacional com o responsável, mesmo que site antigo e protótipo coincidam.

## Segurança e compatibilidade
- `contactWhatsAppUrl()` e `contactEmailUrl()` formam apenas mensagens de intenção comercial curada, com `encodeURIComponent`; mensagens de outro contexto, cabeçalhos CR/LF, controles e texto excessivo são recusados.
- O módulo contém somente canais públicos, sem clientes, dados pessoais de visitantes, chaves, tokens ou integrações.
- A página de contato utiliza o catálogo para links visíveis e scripts de seleção de serviço; o atalho continua funcional sem JavaScript, e a escolha de serviço não realiza POST, cookies, storage nem chamadas externas.
- O auditor de navegação F32 utiliza a mesma origem para os destinos oficiais, mantendo a allowlist de canais exatos e do Portal validado.
- Testes Node e Chromium devem confirmar comportamento e acessibilidade em todas as páginas.

## Dependências que não desaparecem
Política e consentimento LGPD para captação futura, endpoint CRM autenticado, identidade/grants/MFA Portal, contrato/preços oficiais, VPS/staging, GSC/crawl e aprovação humana de DNS/produção continuam pendentes. O CI não simula atendimento real ou recebimento de WhatsApp/e-mail.

Nenhuma alteração na `main`, produção, Cloudflare, DNS, fatura de fornecedor ou dados de visitantes.
