# Imagine Comercial — F315: contato útil após a calculadora, sem captação automática

## O que muda para o visitante

Depois de calcular em português, inglês ou espanhol, o visitante pode
selecionar **Conversar sobre meus canais no WhatsApp**. A ação abre o
aplicativo com **uma mensagem fixa e revisada**, informando apenas que tem
interesse nos canais selecionados, por exemplo Meta Ads e Google Ads.

A mensagem é uma entre **21 opções verificadas** (7 combinações de
Meta/Google/ChatGPT × 3 idiomas). As opções são preparadas no build e
passam pelo mesmo catálogo `contactWhatsAppUrl` já restrito a textos
pré-aprovados. Nenhum texto digitado, meta de leads, teto de orçamento,
CPL, endereço de e-mail, telefone do visitante ou dado pessoal é
incluído automaticamente.

O cliente decide se abre WhatsApp, revisa a mensagem e **confirma o envio**
diretamente no serviço de terceiros. A mera simulação não efetua
solicitação, inscrição, CRM, cobrança, remarketing ou campanha.

O botão **Copiar meu resumo** permanece disponível para quem
**desejar compartilhar voluntariamente** seu planejamento e valores,
sem envio automático. Os links de e-mail/contato tradicionais permanecem.

## Segurança e QA

- O navegador não faz `fetch`, POST, tracking, cookie, fila, integração
  com WhatsApp Business API, armazenamento local ou coleta de identificação.
- O texto pré-aprovado é construído somente com três IDs enumerados;
  mensagens livres/arrays duplicados/getters são rejeitados.
- O link somente é atualizado **depois do cálculo válido**; erro limpa
  o cenário e o link retorna ao padrão, sem reaproveitar valores antigos.
- Chromium valida as três línguas, troca de canais, 7 combinações
  reconhecidas, nenhum valor orçamentário no WhatsApp e nenhuma
  requisição externa sem clique explícito.
- A remuneração mensal mínima da gestão continua pendente de
  homologação financeira no Portal. Sem geração de proposta ou checkout.

## Por que isto não é a integração CRM definitiva

Contato por WhatsApp/telefone/e-mail é um canal aberto pelo visitante.
Não garante **lead persistido e entregue no Imagine CRM** nem comprova
consentimento separado para nutrição automática. Para habilitar o
fluxo real de lead magnet com e-mail e marketing, ainda exigimos
formulário/endpoint autenticado, comprovante de entrega idempotente,
registro de consentimento por finalidade, retenção, descadastro,
autorização de tratamento, rate limiting e testes na VPS.

**REVIEW-ONLY / NO-MERGE / NO-DEPLOY / NO-CAPTURE / NO-CHARGE.**
