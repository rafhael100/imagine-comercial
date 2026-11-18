# Faísca R08-E — planejamento do futuro encaminhamento ao CRM

**Status:** especificação preventiva; nenhuma integração está habilitada.  
**Dependência:** revisão e integração da R07/R08; contrato real do Imagine CRM e avaliação de privacidade.

## Objetivo

Definir como um resumo de qualificação poderá ser encaminhado ao Imagine CRM em uma etapa futura, sem transformar a autorização declarada no questionário atual em envio automático ou em consentimento legal genérico.

## O que existe hoje

O Faísca mantém apenas um perfil comercial enumerado em memória e produz um resumo copiável. O pacote atual é `faisca.lead-handoff.v1`, `delivery=copy_only`, `sent=false`, `operationalEffects=false`. Não há nome, e-mail, telefone, identificador de pessoa, credencial ou canal de contato. Não existe escrita no CRM.

## Envelope futuro proposto (ainda não implementado)

Um futuro envelope server-to-server poderá separar:
- **origem:** produto Faísca e versão do contrato;
- **empresa/tenant:** derivado exclusivamente da identidade autenticada no Portal/CRM, nunca fornecido pelo navegador;
- **qualificação:** solução confirmada, objetivo, público, materiais e previsão, todos com enumerações aprovadas;
- **contato:** ausente por padrão; somente preenchido após uma etapa separada de coleta, com finalidade, canal e aviso de privacidade;
- **preferência de contato:** estado explícito (não perguntado, autorizou, recusou, prefere decidir depois), com data/hora, versão do aviso e escopo;
- **revisão:** pendente de aprovação humana, sem criação automática de lead.

A autorização atual do R08 só registra uma preferência. Não fornece endereço de e-mail/telefone, não prova identidade, não seleciona canal e não deve ser usada isoladamente para iniciar contato.

## Requisitos obrigatórios antes de ativar escrita

1. **Identidade:** vínculo de tenant e usuário autenticado resolvido no servidor pelo Portal/CRM; nunca aceitar tenant, owner ou CRM record ID do visitante.
2. **Aviso e finalidade:** apresentar o aviso de privacidade específico, finalidade, base legal, canal e retenção antes de coletar qualquer dado de contato.
3. **Consentimento granular:** registrar ação afirmativa, escopo, canal, data/hora, versão do aviso e evidência. Recusa e adiamento devem bloquear o envio.
4. **Minimização:** coletar somente os dados estritamente necessários para o retorno solicitado; não armazenar credenciais, dados sensíveis ou transcrições completas.
5. **Revisão humana:** permitir visualizar, corrigir e aprovar o resumo antes de criar/atualizar lead.
6. **Idempotência:** chave de operação gerada no servidor e vinculada à sessão/versão do resumo; replay não pode criar duplicata.
7. **Autorização S2S:** identidade de serviço, credencial curta e rotacionável, escopo mínimo, TLS/mTLS conforme padrão do Portal e nenhuma credencial no browser.
8. **Auditoria:** registrar ator, tenant, operação, consentimento, payload minimizado, resultado, falha e correlação; nunca registrar segredos.
9. **Revogação e exclusão:** refletir retirada de permissão, corrigir/encerrar o encaminhamento e aplicar política de retenção e eliminação.
10. **Falhas:** timeout deve permanecer incerto e ser conciliado pelo mesmo identificador; não reenviar cegamente.
11. **Testes:** ambiente sandbox, dados sintéticos, duplicidade, tenant cruzado, token expirado, revogação, falha parcial, restauração e trilha de auditoria.
12. **Gate de ativação:** aprovação humana explícita, revisão independente, documentação de privacidade e CI verde antes de qualquer escrita real.

## Não fazer nesta fase

- Não criar endpoint, token, tabela ou campo de produção.
- Não conectar Asaas, CRM, Portal, e-mail ou mensageria.
- Não coletar telefone/e-mail ou enviar leads.
- Não considerar `contactConsent=granted` como autorização suficiente para envio.
- Não ativar gravação, automação, scoring ou enriquecimento de dados.

**Conclusão:** R08-E é um contrato de segurança e produto para orientar a integração futura. O Faísca continua copy-only até que todos os requisitos e aprovações acima sejam concluídos.
