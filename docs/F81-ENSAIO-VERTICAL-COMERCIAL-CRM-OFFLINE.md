# F81 — Ensaio vertical offline de orçamento Comercial → CRM

## Objetivo
Encadear em um único diagnóstico os contratos **já implementados em laboratório** e comprovar que nenhum deles, isoladamente ou somado aos demais, pode autorizar captação pública.

## Jornada fictícia
O `reviewSyntheticCommercialCrmPath` executa, em memória e sem transporte:

1. **F30 Comercial:** rascunho sintético exige serviço conhecido, e-mail, conteúdo mínimo, aceite marcado e honeypot vazio. O aceite alegado não é prova auditável de consentimento.
2. **F79 CRM mínimo:** avalia nome/contato em um subconjunto estritamente sintético; telefone vazio do Comercial é convertido em `null` para respeitar o contrato proposto do CRM. Isso não resolve divergência normativa entre campos obrigatórios.
3. **F78 Envelope:** exige oito campos, protocolo e versão de laboratório, seis UUIDs alegados. Não verifica a identidade ou a propriedade desses IDs.
4. **F80 CAS:** classifica escopo lógico, imutabilidade do destino e versões/estados do ledger. Mesmo `ATOMIC_STORE_REQUIRED` é somente uma indicação de que falta um banco transacional real.

A resposta fornece apenas **fase e código diagnóstico**, com `consentProven:false`, `tenantBindingVerified:false`, `durableReservationProven:false`, `crmDeliveryProven:false`, `canSubmit:false`, `canAcknowledge:false` e `deploymentAuthorized:false`. Nunca retorna nome, e-mail, telefone, detalhes ou referências de organização.

## Testes negativos
`tests/commercial-crm-vertical-dryrun.test.mjs` cobre hipótese nominal não autorizada, consentimento alegado inválido, honeypot, campos extras, versão/protocolo errados, troca de empresa/destino, CAS obsoleto e estado de entrega desconhecida. O código não é importado pelo Astro público.

## Critérios que continuam faltando para liberar F70
- Formulário real acessível com política de privacidade, finalidade adequada, autenticação de origem, antispam/rate limiting e operação segura.
- Backend Portal com vínculo de tenant e site/formulário verificado no servidor, grants, outbox durável e idempotência transacional.
- CRM com isolamento por empresa, recibos efetivos, reconciliação, acesso restrito, retenção e exclusão.
- Homologação em staging isolado, revisão independente de segurança/LGPD e validação da equivalência da captação do site antigo.
- Aprovação explícita de implantação, com rollback de DNS e migração SEO.

**Sem entrega real, API, processamento de dados pessoais de clientes, publicação, merge main ou despesas.** A integração real exige projeto de backend e revisões independentes — o ensaio não substitui essas etapas.
