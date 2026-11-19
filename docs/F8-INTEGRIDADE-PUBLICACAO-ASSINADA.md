# F8 — Catálogo publicado: assinatura offline e separação de autoridade

## Objetivo
Garantir que **um arquivo de catálogo público** recebido do futuro publicador do Portal foi assinado por uma chave privada cujo par público está autorizado pela Imagine.

## Protocolo experimental
Envelope JSON com somente `protocol=imagine-catalog-v1`, `keyId`, `payloadBase64` e `signatureBase64`. A assinatura Ed25519 cobre o prefixo de domínio `imagine-commercial-catalog-v1\0` e os **bytes exatos** do JSON de catálogo, em UTF-8. O verificador não reserializa antes de conferir; mudanças de espaço/campos invalidam a assinatura.

O payload precisa obedecer ao contrato público F2. Chaves públicas registradas como pares `keyId -> PEM`. A chave privada deve permanecer exclusivamente no ambiente confiável do publicador do Portal, nunca em frontend, CI público ou repositório.

## Funcionalidade entregue
- Verificação Ed25519 offline, validação de base64 canônico, tamanho máximo do payload de 1MiB e schema publicável.
- Rejeição de versões, dados privados, draft e campos fora do contrato, após assinatura válida.
- Testes com chaves descartáveis geradas em memória, sem segredos de clientes.
- CLI opcional que recebe arquivo local e chave pública PEM; não toca DNS, API nem deploy.

## Importante: não é um publicador completo
Assinatura comprova integridade e a chave usada, mas **não confere autorização editorial nem de tenant**. Autorização, revogação de chaves, auditoria, anti-replay com estado persistente, ordem transacional e aprovação continuam sob responsabilidade do Portal e do publicador. Não anexar snapshots reais ou dados privados ao GitHub.

**Sem integração real, sem produção, sem merge na main.** Referência: issue #4, PR #5.
