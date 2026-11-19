# Faísca R36 — verificar o contrato real do Portal Onepage em SHA fixa

**Base:** R35 [#499](https://github.com/rafhael100/imagine-comercial/pull/499); integração preparada na R34. **Contrato externo:** Portal Onepage [#941](https://github.com/rafhael100/imagine-portal/pull/941), commit `0e0ccc06755b6ddd938635e5c4c3625ff6497e2c`.

## Objetivo

A R34 constrói uma intenção Onepage **sem autoridade de compra**. A segurança desse contrato depende de uma versão efetiva do Portal exigir sessão e autorização do comprador, idempotência, seleção restrita, preço e termos definidos pelo servidor.

Não basta citar a documentação do Portal: a compatibilidade precisa ser conferida **contra os bytes reais** da candidata revisada. A R36 torna esse requisito executável no CI, sem depender de uma branch que muda.

## Implementação

`ops/faisca/qualification/verify-native-portal-pin.mjs` aceita um diretório de checkout Portal já existente e inspeciona quatro arquivos:

- controlador `OnepageOrderController.php`, que exige `request_key`, `selection` e sessão `portal.browser_auth` em fase `business`;
- `OnepageOrderCommands.php`, que restringe a seleção a exatamente `channels,site,tier`, `site=onepage`, `channels=[]` e `tier=minimum|recommended`;
- `config/portal_onepage.php`, em que a ativação do checkout nativo está **desligada por padrão**;
- `NATIVE-ONEPAGE-CHECKOUT.md`, que delimita o papel da identidade do comprador e do servidor.

Para cada arquivo, o verificador confere o **hash de blob Git** conhecido no commit revisado, rejeita links simbólicos, arquivos fora do checkout, tipos e tamanhos inesperados e confirma o conjunto de regras esperado. Retorna apenas contagens, status e commit, sem transcrever código ou dados.

O workflow `.github/workflows/faisca-native-portal-contract.yml` executa:
1. checkout da própria candidata Faísca na SHA da PR, sem persistir credenciais;
2. checkout **esparso**, somente leitura, de quatro arquivos do `imagine-portal` exatamente no commit fixado;
3. comparação do SHA do checkout;
4. testes R34 e R36 e verificação efetiva dos hashes e contratos PHP.

`tests/faisca-r36-native-portal-pin.test.mjs` testa a recusa de alteração individual de cada regra, manifesto sintético incorreto, parâmetros inválidos e a operação determinística do hash de blob.

## Limites importantes

- Hash Git e commit fixo são **prova de versão de fonte**, não assinatura de release nem prova de que essa fonte foi publicada. É necessário revisar a proveniência e os mecanismos de confiança da CI.
- Inspeção estática de PHP **não substitui teste de autenticação, PostgreSQL, MFA, CSRF, TLS ou checkout operacional**. O Portal #941 já tem suas próprias provas de laboratório; a R36 só impede compatibilidade ilusória com outra versão.
- O checkout do CI é somente de leitura e nunca acessa banco, servidor de pagamento, contas de clientes, e-mail, segredos ou VPS. Nenhuma chamada ao Portal é realizada.
- Nenhuma aprovação de compra é inferida do estado `contactConsent` do Faísca.

## Próximo gate real

Antes de transformar a intenção R34 em pedido, o Portal precisa estar em staging HTTPS operacional e autenticado, a sessão deve ser do próprio Portal e o plano de serviço precisa ser selecionado pelo comprador, com cotação e contrato emitidos e validados no servidor. A interface Comercial ainda tem checkout público em **NO-GO** e o Faísca continua apenas com resumo copiável.

**Sem merge, deploy, DNS, VPS, clientes reais, custos, LLM externa, cobrança ou alteração do mascote.**
