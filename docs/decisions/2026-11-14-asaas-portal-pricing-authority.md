# Gateway e fonte comercial — decisão 14/11/2026

O titular escolheu **Asaas** como gateway e determinou recuperar os preços aprovados da primeira versão Node do Imagine Portal.

Fonte canônica da decisão e catálogo financeiro: [Imagine Portal PR #737](https://github.com/rafhael100/imagine-portal/pull/737), commit `ae71e4711257e2ae22043cb736acc639ba921ac8`, arquivos `docs/decisions/2026-11-14-asaas-and-legacy-pricing.md` e `docs/decisions/approved-commercial-catalog.json`.

A oferta foi recuperada do Node no commit `50b683a499e674641df5749051f3d05f7ac3f627`, modelo `subscription-v2`. O Comercial não mantém uma segunda tabela de preços: exibição e contratação devem consumir oferta publicada pelo Portal, com versão e condições correspondentes ao aceite no checkout. Preço enviado pelo navegador não constitui autoridade financeira.

O Portal responde por pedido, titularidade, contrato, cliente Asaas, pagamento, recorrência, conciliação e recibos. O Comercial conduz a seleção do serviço ao Portal. A decisão não comprova integração financeira Laravel concluída, não ativa cobrança, não configura chaves nem altera publicação.

Landing Page e Performance seguem sem preço confirmado nas fontes Node revisadas; não apresentar valores inventados, preço zero ou pagamento direto até localizar a oferta aprovada. Preservar as condições dos contratos legados. Não aplicar descontos adicionais sem confirmação na fonte vigente.

Este registro é documental em branch de revisão. A próxima implementação deve homologar Asaas sandbox, oferta versionada, vínculo seguro Comercial/Portal, autorização do titular e retorno financeiro idempotente antes de habilitar transações reais.
