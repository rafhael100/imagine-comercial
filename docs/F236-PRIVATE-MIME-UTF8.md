# F236 — MIME e UTF-8 estritos na prévia privada

Os controles F234–F235 confirmam que HTML e assets recebidos em HTTP local coincidem com o pacote estático aprovado. A F236 evita aprovação enganosa quando bytes corretos são entregues com **tipo de mídia inadequado**:

- CSS deve responder `text/css`;
- JS deve responder um MIME JavaScript conhecido;
- sitemap deve responder `application/xml` ou `text/xml`;
- robots deve responder `text/plain`;
- fontes e imagens seguem suas famílias MIME permitidas.

HTML recebido em streaming usa agora decodificação UTF-8 **fatal**, sem substituir bytes inválidos silenciosamente. Os testes F236 confirmam recusa de CSS entregue como `text/plain` e de corpo HTML com UTF-8 malformado. O erro é genérico para não expor conteúdos em logs.

Esse ensaio cobre somente staging privado por loopback e HTTP Basic, com saída não publicável. A ausência de erros não certifica TLS público, DNS, identidade da VPS, integrações Portal/CRM, consentimento, migração SEO ou aprovação para produção.
