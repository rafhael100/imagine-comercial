# Comercial F353 — prova cruzada de paridade PHP e isolamento PostgreSQL 18

**Estado: DRAFT / NO-GO / SOMENTE CI DESCARTÁVEL.**

## Objetivo funcional
Provar em uma única execução de integração que os **48 estados possíveis** do seletor público Imagine Comercial continuam compatíveis com o cálculo composto **feito pelo PHP real do Portal**, e que um rascunho dessa classe permanece isolado por papel de empresa e não se duplica quando solicitações simultâneas são testadas com processos PHP independentes.

## Proveniência imutável
- Comercial: exata HEAD do PR, checkout sem persistência de credenciais.
- Portal: SHA fixa `6ac1be6a543218c880ebd411b15c8c3a83dacb81`, incluindo F350/F351/F352; sem merge entre os repositórios.
- Banco: PostgreSQL 18-alpine, nome `portal_composite_f350_ci`, endpoint de cliente `127.0.0.1:5432`, roles e senhas **sintéticas exclusivas deste job**.
- PHP: 8.3 com PDO PostgreSQL; Node 22.

## Critérios automáticos
1. Conferir SHA do Portal e configuração efetiva de banco.
2. Rodar o PHP `CompositeQuotePreview` sobre 48 seleções: 22 cálculos de laboratório e 26 recusas, incluindo ChatGPT Ads fora do catálogo.
3. Confrontar **cada** cotação válida contra os valores em centavos do motor Comercial: site, mídia direta às plataformas, ativação, parcelas, mensalidade D+90 e gestão pós-paga.
4. Criar apenas roles sintéticas de leitura com `NOBYPASSRLS`, aplicar `FORCE RLS` e índice de idempotência no banco descartável.
5. Disputar chaves com processos PHP simultâneos reais: um único INSERT por empresa/chave, replays idênticos, recusa de payload alterado, nenhuma leitura interempresa, revogação prevalecendo sobre replay.
6. Revogar `CONNECT`, apagar o schema e remover as roles em `always()`. Não editar arquivos rastreados nos dois checkouts.

## Limite essencial
A classe `SyntheticDraftWriter` usa **administrador sintético** somente em CI. Ela **não deve ser reutilizada na operação**. No Portal real, faltam identidade verificada do cliente, associação autorizada a organização, sessão MFA, concessões e revogação, credencial escritora de privilégio mínimo, aprovações contratuais, persistência transacional operacional, reconciliação, gateway de pagamento e auditoria independente.

**CI verde não significa carrinho disponível, pagamento autorizado, domínio publicado nem liberação de produção.**
