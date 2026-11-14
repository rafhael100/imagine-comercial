# Asaas e autoridade financeira do Portal — 14/11/2026

Gateway escolhido: **Asaas**. Fonte canônica das condições de Onepage, Landing Page e Performance: [Portal PR #737](https://github.com/rafhael100/imagine-portal/pull/737), commit `0b247d9a06b86b87e2d4b34c69121fd6e72a5d52`, arquivos `docs/decisions/approved-commercial-catalog.json` e documentos de decisão na mesma pasta.

Landing Page foi recuperada na documentação Node IN-115, commit `76ce533da42bf5d195ebffcdc8a110d1bc70f9b8`. Preservar também o complemento de conteúdo incluído nas novas ofertas Onepage/Landing Page e contratos legados.

## Nova definição Performance

A divergência histórica de tabela foi resolvida pela nova decisão expressa do titular em 14/11/2026: **honorários de 20% da mídia investida, com investimento mínimo em anúncios de R$ 700 por canal**. Ver [decisão canônica](https://github.com/rafhael100/imagine-portal/blob/0b247d9a06b86b87e2d4b34c69121fd6e72a5d52/docs/decisions/2026-11-14-performance-20-percent-media.md).

O mínimo é de **verba publicitária**, não de honorários. A mídia é paga diretamente às plataformas, separada da gestão Imagine; Meta/Instagram/Facebook representam um canal Meta. Não reutilizar os antigos pisos/percentual ou pacotes simulados, nem criar taxa de ativação/adicionais automaticamente. Contratos existentes não são reajustados retroativamente.

O Comercial não mantém segunda tabela financeira: consome oferta versionada do Portal, responsável por titularidade, contrato, cálculo no servidor, Asaas e conciliação. Navegador não define preço. A exibição pública precisa discriminar verba de anúncios e honorários. Período de apuração, vencimentos e acertos devem ser definidos antes de cobrança real; não herdar D90/descontos dos sites.

Registro documental em revisão, sem ativar checkout, credenciais, fiscal, publicação ou provisionamento. A aprovação comercial está registrada; implementação e homologação financeira são etapas distintas.
