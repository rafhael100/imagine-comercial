# PERF-CALC-P0 — calculadora pública + estratégia de lead magnet

**Data:** 2026-11-14.
**Autorizado pelo titular:** mínimos e valores recomendados distintos Meta/Google/ChatGPT, calcular sugestão a partir de dados do visitante, usar interesse resultante como possível entrada ao CRM Imagine para nutrição futura.
**Status:** DRAFT / NO-MERGE / NO-DEPLOY / NO-CRM-WRITE / NO-CONSENT-CLAIM.

## Escopo implementado

Páginas públicas /calculadora-de-anuncios/, /en/budget-calculator/ e /es/budget-calculator/ em Astro, sem login e com hreflang revisado:
1. Selecionar de 1 a 3 canais (Meta, Google, ChatGPT). Meta reúne Instagram/Facebook.
2. Informar objetivo comercial (leads, vendas, reconhecimento).
3. Opcional: meta de leads mensal + CPL histórico **fornecido pela pessoa**, ambos juntos.
4. Opcional: teto mensal disponível para mídia. Teto inferior gera alerta, nunca altera orçamento por conta própria.
5. Exibir mínimo de contratação **por canal**, valor recomendado inicial, distribuição por canal, estimativa de honorários Imagine 20% e total informativo. Mídia vai diretamente a cada plataforma.
6. Link de contato no WhatsApp/e-mail autorizado pela pessoa, cópia de resumo local e opção de imprimir/salvar em PDF via diálogo nativo do navegador (somente clique humano).
7. A calculadora não persiste informações, não usa cookies de rastreamento, não envia eventos à rede, não salva e-mail e não aciona anúncios, cobrança ou contrato.

## Decisões comerciais aprovadas

| Canal | Piso mensal Imagine (BRL) | Recomendado inicial (BRL) |
| --- | ---: | ---: |
| Meta | 700 | 1.000 |
| Google | 1.000 | 1.500 |
| ChatGPT | 1.200 | 1.800 |

Os valores são referência comercial de entrada e não previsão de resultados ou piso técnico universal do provedor. ChatGPT possui regra oficial de R$40/dia para orçamento diário em BRL, equivalência de 30 dias R$1200, sem mínimo mensal universal. Revalidar regras no onboarding da conta.

## Fórmula transparente P0

- Sem CPL histórico próprio: soma das recomendações de cada canal selecionado.
- Se há meta de leads E CPL histórico declarados: cenário total = max(soma das recomendações, meta × CPL próprio); distribuir pelos canais proporcionalmente às recomendações de base, arredondando cada parcela **para cima** aos R$10 mais próximos. Essa divisão é uma hipótese de planejamento, não projeção comparável entre plataformas.
- Alertar se o teto de mídia está abaixo da soma recomendada, sem operar gasto nem reduzir planejamento de forma automática.
- Honorários ilustrativos = 20% da verba recomendada. Cobrança real continua sobre mídia efetivamente investida, antecipada por estimativa e conciliada ao fim do mês conforme política do Portal.
- Se não há histórico confiável não estimar quantidade de leads, CPL, receita, CPA ou ROAS. O objetivo selecionado é informativo, não altera valores sem evidência.

## Próxima entrega: captura e nutrição CRM integrada, atualmente BLOQUEADA

O site comercial Astro é estático e o formulário de contato original não envia informações a CRM. Não instalar formulário de e-mail falsamente operacional ou endpoint público sem backend auditado. Abaixo está o contrato candidato para fluxo no backend isolado:

1. Visitante consulta o resultado **anonimamente**.
2. CTA "Receber meu plano por e-mail" abre formulário com nome + e-mail + telefone opcional **somente após o backend estar homologado**.
3. Consentimentos/solicitações separados:
   - Envio do estudo solicitado: finalidades e base legal próprias, comprovantes e política de privacidade.
   - Receber dicas, conteúdos, novidades e propostas futuras: opt-in específico e opcional **desmarcado por padrão**. Recusar não bloqueia estudo.
4. Nunca apresentar "autorizou marketing" quando apenas pediu orçamento ou abriu WhatsApp. Consentimento ao contato comercial no serviço não presume newsletter.
5. Após servidor validar formulário: token CSRF/antibot, rate limiting, anti-replay, event_id/idempotência durável, versão do aviso e registro de quando/como cada preferência foi informada. Identidade da origem e do tenant Imagine atestada exclusivamente no backend, sem aceitar tenant do browser.
6. Criar lead idempotente na origem "calculadora_performance" e vincular ao funil do CRM **somente com binding/integração autenticada**. Status de entrega confirmado pelo CRM antes de mostrar mensagem de sucesso. Retries, DLQ e auditoria sem PII em logs.
7. Sequência opcional de nutrição apenas com permissão válida e mecanismo de descadastro funcional: envio do estudo; conteúdo educacional; comparação de canais; convite para diagnóstico/contratação. Se recusar ou revogar, suspender sequência imediatamente.
8. Registrar objetivo, canais, limites e estimativa no CRM como preferências declaradas e **não** como receita realizada. Nunca atribuir leads de terceiros a quem só utilizou a ferramenta.
9. Sem crédito automático, campanha real, Asaas, disparo de e-mail ou WhatsApp a partir do frontend. Não armazenar dados pessoais em URL/cookies/analytics.
10. Validar hospedagem e políticas de retenção, exercício de direitos e base legal com responsáveis LGPD antes de coletar dados pessoais.

O script `scripts/test-calculator-browser-ci.mjs` testa as três versões no Chromium real via preview HTTP autenticado em loopback e verifica conta Meta, seleção dos três canais, honorários, ausência de PII, POST e tráfego externo. Os testes do site principal seguem independentes e são requisito adicional de publicação.

## Contrato técnico bidirecional em laboratório

O Comercial implementou `src/lib/synthetic-calculator-interest-interop-lab.mjs`: envelope de **interesse sintético**, metadados sem PII, com HMAC-SHA256 de CI, nonce, competência temporal, canais e mídia em centavos; sem envio por HTTP, sem credencial real e sem inferir consentimento. O código recusa campos inesperados, valores adulterados, arrays com acessores e permissão de marketing indevida.

O emissor `scripts/emit-calculator-interest-fixture-ci.mjs` gera um vetor público fixo de **teste**, com chave descartável. O CRM contém verificador PHP equivalente, e o workflow CRM consome o código Comercial fixado ao commit `f2454eb58b77702f2df69be658c43ecd49f3beb3`, verificando o vetor e registrando os metadados em PostgreSQL16 temporário com RLS e replay seguro. O vetor não contém e-mail, nome ou telefone.

**Status:** integração cross-repo de laboratório. A calculadora pública continua sem nenhum formulário que envia dados pessoais; o usuário pode imprimir/salvar o estudo pelo diálogo do navegador. A prova em PostgreSQL é isolada, não é recibo operacional de lead.

## Dependências e aceite

- Portal: contrato de origem e permissões da Imagine para Performance e CRM; catálogo versionado; site institucional não dispara contrato nem cobrança.
- CRM: endpoint privado e fila/outbox idempotente com confirmação, política de exclusão/retensão e opt-in discriminado; status atual = não homologado.
- Comercial: autorização de publicação do novo caminho, QA acessibilidade/mobile e bloqueio de telemetria de PII.
- UX: leitura no mobile, sem cadastro obrigatório, sem falsa escassez, texto de privacidade claro.
- SEO: página indexável apenas após homologação editorial, sem SEO programático enganoso.

Referências LGPD/ANPD:
- https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-orientativo-sobre-legitimo-interesse
- https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes
