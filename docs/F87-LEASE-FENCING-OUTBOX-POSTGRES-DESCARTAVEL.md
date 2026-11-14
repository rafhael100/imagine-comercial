# F87 — Recuperação de consumidores e fencing de outbox no PostgreSQL descartável

## Hipótese e escopo
A F86 provou em PostgreSQL real que um evento `pending_review` é gravado atomicamente junto à reserva de seus metadados. A F87 testa a próxima falha: um consumidor obtém o evento, deixa de responder e outro consumidor tenta recuperá-lo. Nenhum processamento real, dado pessoal ou comunicação com o CRM é usado.

O teste corre **somente** no banco `imagine_comercial_ci` recém-criado pelo workflow F51 no runner GitHub, após a F85 e a F86. As políticas de segurança do CI proíbem hosts PostgreSQL externos e recusam papéis de laboratório pré-existentes antes de qualquer limpeza.

## Implementação e evidências
- `tests/sql/lead-outbox-lease-ephemeral.sql` cria, somente na fixture de testes, quatro colunas: `state` (`queued`, `claimed`, `reconciled_lab`), `claim_version`, `attempts` (máximo três) e `lease_until`. O estado `reconciled_lab` **não é recibo de entrega real**.
- Dois papéis `NOLOGIN/NOBYPASSRLS` de consumidores fictícios recebem leitura e UPDATE **somente das quatro colunas de estado** e políticas fixadas em empresas sintéticas. Não podem editar o identificador do evento, organização, submissão ou tipo.
- `scripts/test-lead-outbox-lease-ephemeral-ci.sh` dispara **dois processos PostgreSQL concorrentes** tentando reservar a mesma linha `queued/version=0`. A constraint transacional exige exatamente um vencedor.
- Durante a validade da concessão (*lease*), nova tentativa não obtém a linha. O runner simula a falha do consumidor forçando a concessão ao passado **com privilégio de fixture**, sem conceder essa permissão ao consumidor.
- Um novo consumidor obtém `claim_version=2`. A tentativa tardia do consumidor antigo, com `claim_version=1`, é rejeitada. Só a versão corrente pode marcar a linha como `reconciled_lab`; repetição dessa operação também é rejeitada.
- Consultas/escritas cross-tenant e tentativas de INSERT, DELETE, TRUNCATE ou UPDATE de colunas imutáveis pelo consumidor falham. O arquivo de testes Node garante que os guardrails não desapareçam nas futuras refatorações.
- O runner descarta o banco e os papéis reservados ao final. A fixture completa contém apenas referências UUID e metadados: **sem nome, e-mail, telefone, mensagem ou payload**.

## Limitações essenciais
As concessões e versões testadas não criam worker operacional; não há polling de verdade, API, transporte, autenticação de serviço, criptografia de contatos, política de consentimento, confirmação assinada do CRM, reconciliação entre duas infraestruturas, observabilidade, retenção ou recuperação após uma falha da VPS. Mesmo uma linha `reconciled_lab` não prova recebimento por qualquer destino.

A execução de laboratório **não autoriza implantar** SQL em banco persistente, converter o formulário de orçamento em captação real, nem publicar o site. A integração Portal/CRM dependerá de revisão SEG/DBA, grants efetivos, staging privado e homologação independente com recibo de destino. O bloqueio F70 continua ativo.

Sem gastos novos, dados reais, alterações em `main`, DNS, VPS ou produção.
