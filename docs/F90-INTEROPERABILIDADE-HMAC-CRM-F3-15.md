# F90 — Compatibilidade HMAC de recibos: Comercial ↔ CRM F3-15

## Fonte e objetivo
O CRM Imagine já implementou, no recorte de laboratório `dev/f3-16-postgres-nonce-replay-lab-2026-11-08`, o componente PHP `app/Core/Leads/SyntheticLeadReceiptMacInspector.php` (F3-15). A F90 verifica **em Node 22**, no próprio repositório Comercial, os mesmos bytes canônicos de HMAC-SHA256 de metadados e os estados de rejeição, sem envolver rede ou dados reais.

A interoperabilidade é limitada a uma **fixture sintética fixa**, não a um handshake real entre servidores. A chave de teste é declarada explicitamente como fictícia e nunca deve ser utilizada na produção.

## Contrato testado
- Domínio `imagine.lead-intake.synthetic-receipt.v1`.
- Campos HMAC, na ordem do PHP: organização, vínculo, submissão, site, formulário e destino — seis UUIDs em minúsculas —, `issuedAt`, `expiresAt` em segundos inteiros e `nonce` UUID em minúsculas. Os dez elementos são unidos por `LF` (sem linha final).
- Janela de laboratório provisória: validade positiva de até 300 segundos, relógio de emissão no máximo 30 segundos à frente, vencimento estritamente posterior ao instante de inspeção.
- Chave de teste com no mínimo 32 **bytes** UTF-8, assinatura hexadecimal minúscula de 64 caracteres e comparação `timingSafeEqual`.
- Códigos alinhados ao PHP: `PINNED_CONTEXT_MISMATCH`, `TIME_WINDOW_INVALID`, `NONCE_FORMAT_INVALID`, `CRYPTO_INPUT_INVALID`, `MAC_MISMATCH` e `LAB_MAC_MATCH_UNTRUSTED`.
- Entradas malformadas, campos extras e envelopes F78 inválidos falham antes do processamento. A avaliação devolve apenas código diagnóstico e flags invariavelmente falsas: **aceite do lead, recibo durável, entrega CRM, proteção contra replay, tenant autenticado e produção não estão autorizados**.

A fixture de referência, reproduzindo exatamente as constantes do teste PHP `tests/Unit/SyntheticLeadReceiptMacInspectorTest.php`, usa exclusivamente UUIDs artificiais 1111…6666, nonce 8888…, janela fictícia 1800000000–1800000300 e chave identificada como fixture. O MAC esperado é fixado no teste Node para detectar regressões de normalização ou ordem dos campos.

## Cobertura negativa
- Alterações de organização, vínculo, envio lógico, site, formulário ou destino.
- Assinatura adulterada, chave diferente, nonce alterado, formato inválido de assinatura/nonce e chave curta.
- Janela vencida, negativa, invertida, longa ou emitida além de 30 segundos no futuro.
- Reutilização da mesma assinatura: **duas inspeções idênticas continuam a coincidir**, comprovando que MAC isolado não previne replay.
- Ausência de importação pelo Astro público e ausência de chamadas HTTP, envio ao CRM, logs de contatos ou armazenamento.

## O que ainda falta para F70
Uma assinatura HMAC com chave fornecida pelo próprio chamador **não autentica a origem**. A integração operacional precisará de identidade de serviço e KMS/vault, rotação/revogação de chaves, TLS, assinatura de payload/cabeçalhos canônicos conforme protocolo versionado, autorização efetiva de site/formulário/tenant, transação de nonce idempotente no destino, resposta de persistência assinada e conciliação de timeouts. O CRM F3-16 já demonstra em laboratório que nonce e chave de submissão são controles diferentes e que bases independentes não garantem exclusão global de replay.

F90 não altera as provas SQL F85–F89, não conecta a VPS, não ativa formulário, API ou worker, não utiliza contatos, não modifica `main`/DNS e não autoriza custos. O gate `legacy-contact-intake-parity` F70 permanece bloqueado até homologação operacional e revisão independente de SEG/DBA/LGPD.
