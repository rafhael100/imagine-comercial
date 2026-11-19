# Faísca R20 — comparação de soluções verificada por fonte PHP

**Base:** R19, PR #482. **Escopo:** laboratório isolado; nenhum checkout, CRM, Portal, cliente, IA generativa ou dado real.

## Por que

A R19 identifica quando a escolha de Site Onepage/Landing Page e o objetivo do visitante merecem revisão, mas apenas aconselhar “vale comparar” não basta. A pessoa precisa de um caminho fácil para consultar as diferenças **com a base editorial existente**, sem reiniciar a qualificação nem aceitar uma alteração automática.

## Implementação

A resposta **Como avançar?** oferece o botão **Comparar Onepage e Landing Page**, além de rever o resumo, trocar serviço e corrigir respostas. O botão utiliza o `compare_sites` já aprovado e versionado no catálogo R06.

Diferentemente do próximo passo e do alerta R19, que são textos fixos, a comparação factual passa por:
1. ação enumerada do visitante;
2. estado R08 confiável preservado, sem trocar serviço;
3. `groundedRespond` retornando candidato editorial `compare_sites`;
4. validação independente do texto, fontes e ações pelo PHP real do Imagine AI Agents, no laboratório de CI;
5. se a resposta demorar, conciliação explícita do mesmo turno; nenhuma redespachada automática.

Somente depois da validação a resposta é associada ao resumo da R08. Falha ou conteúdo sem fonte não pode ser apresentado como resposta factual confirmada.

## Testes

`tests/faisca-r20-grounded-comparison.test.mjs` cobre fonte R06 exata, preservação de serviço/perfil/consentimento, menu de quatro ações, fonte ausente ou adulterada, e comparação permitida apenas pela escolha explícita.

O `ops/faisca/qualification/http-browser-qa.mjs` foi estendido para:
- clicar **Como avançar?** sem chamar PHP;
- clicar **Comparar Onepage e Landing Page** e observar um processo PHP real pinado;
- aguardar e conciliar a resposta, sem depender do número acumulado de mensagens no chat;
- verificar origem/citações R06 e preservação do resumo;
- voltar ao menu e permitir troca/cancelamento conforme as regras R15.

A rotina agora contém um despacho PHP adicional de comparação; os asserts de contagem foram ajustados sem alterar regras de timeout/replay.

```bash
node --test tests/faisca-r20-grounded-comparison.test.mjs tests/faisca-r19-service-fit.test.mjs tests/faisca-r17-next-step.test.mjs
npm test
```

CI com PHP pinado, Chromium e Comercial precisa passar **na SHA desta PR**. O laboratório não é prova de implantação, disponibilidade de checkout nem homologação de IA externa.

**Sem mudanças no mascote, CSS público, `src/`, `public/`, produção, DNS, VPS, fornecedores, custos, credenciais, pagamento ou clientes reais.**
