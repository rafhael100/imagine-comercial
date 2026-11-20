# Faísca R148 — privacidade de domínios sem protocolo e IPs

## Lacuna efetiva

Os gates R80–R147 recusam URLs com protocolo, `www.`, e-mails, sequências longas de dígitos e vários identificadores. Porém, uma pergunta *aparentemente fictícia* como “a página usa loja-ficticia.example?” ou “o servidor é 10.0.0.1?” continha um domínio/IP **sem protocolo** e podia passar pelo preflight, saindo para o provedor de IA. Respostas de modelo ou um HTTP 200 local comprometido também podiam exibir esses dados.

## Recorte R148

- `private-identifier-risk.mjs`: identificadores de hostname sem protocolo, IPv4, IPv6 e `localhost`, com normalização Unicode existente. O mesmo controle serve à entrada autoritativa do servidor HTTP e à saída do cliente Luna/Terra; não se faz DNS lookup.
- `private-review-page.mjs`: segunda barreira independente para pré-envio da pergunta no navegador e para egress da resposta no DOM. Apaga bearer, pergunta e confirmação quando rejeitada.
- `tests/faisca-r148-private-network-address.test.mjs`: verifica exemplos reservados sintéticos (TLD `.example`, faixa privada IPv4, documentação IPv6), compatibilidade de pergunta neutra, ausência de dispatch HTTP em input rejeitado, requisições mock Luna/Terra sem retry/sem devolver reservas, e navegador real via execução do JavaScript da interface em VM com HTTP 200 adulterado.
- A CI existente continua executando Node/HTTP, Chromium/axe WCAG, catálogo editorial, integridade exata dos assets estáticos, Onepage/Portal PHP, PostgreSQL descartável e Comercial/SEO. Verificar os **seis workflows na HEAD exata**, não inferir sucesso desta nota.

## Limites e critérios

Controle lexical conservador: bloquear string com aparência de hostname não prova PII real e pode bloquear perguntas fictícias; não constitui DLP geral nem aprovação LGPD. Certas representações alternativas de IP e nomes incomuns podem escapar; um teste de laboratório não substitui revisão AppSec ou homologação operacional. Não persistir nem publicar perguntas. Não usar dados reais.

R92 e teste privado pago Luna/Terra foram declarados concluídos pelo operador: **não repetir** nem presumir R95+ instalada na VPS. Esta entrega não usa chaves nem realiza chamadas pagas. Não autoriza merge, deploy, DNS, alteração de VPS, tráfego de clientes, CRM/Portal operacional, leads, tickets, compras ou cobrança.

A candidata permanece em **PR draft, sem GO público**. Preservar `main`, site, mascote e `publicFaiscaEnabled=false`.
