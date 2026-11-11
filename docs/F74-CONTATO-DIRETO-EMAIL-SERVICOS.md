# F74 — Contato direto também por e-mail nas páginas de serviços

## Entrega
Cada uma das seis páginas de serviço Astro passa a oferecer um segundo canal direto, e-mail, ao lado do WhatsApp já disponibilizado pela F73. Ambos são URLs construídas exclusivamente com o slug público já revisado, a partir de `composeCuratedContactLinks`; o e-mail leva somente assunto curado e o WhatsApp somente mensagem curada.

## Privacidade e acessibilidade
O visitante escolhe iniciar a conversa no aplicativo externo e confirma o envio; não há formulário, PII, API, cookies, armazenamento, evento de conversão ou envio automático. O aviso de transferência externa é compartilhado por `aria-describedby` nos dois links. Os números e endereço vêm da única fonte `src/data/contact-channels.mjs` e ainda exigem reconfirmação humana antes do lançamento.

## Validação e limites
`node --test tests/service-contact-channel-fallback.test.mjs` cobre os seis serviços, a restrição de dados e a semântica dos links. Executar ainda `npm test`, `npm run build`, CI e QA browser antes de integração. Os gates de equivalência do formulário legado F70, migração SEO, homologação e publicação continuam **bloqueados**. Sem alteração da `main`, DNS, CRM, VPS ou custos.
