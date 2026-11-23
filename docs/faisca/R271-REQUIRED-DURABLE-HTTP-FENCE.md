# Faísca R271 — sem downgrade silencioso da cerca privada (DRAFT)

R270 #750 estreitou a janela entre conclusão do provedor e emissão HTTP 200 ao revalidar o marcador de despacho durável no servidor. R271 adiciona um **gate de capacidade obrigatório**: qualquer adaptador que se anuncie como `localDurableReservations: true` em `lab.inspect()` deve implementar `assertPrivateHttpDeliverySafe()`. Sem isso, o listener se recusa a abrir a porta. Caso a capacidade seja removida posteriormente, a resposta também falha conservadoramente e não emite HTTP 200.

Esse contrato impede regressões em refatorações de adaptadores e não altera os mocks não duráveis de laboratório. Nenhuma mudança na política de reserva, nas chamadas OpenAI ou na UI pública.

Teste executável:

```sh
node --test tests/faisca-r271-durable-http-fence-required.test.mjs
```

A primeira fixture declara um ledger durável sem hook e exige falha **antes do bind TCP**. A segunda declara modo não durável, confirma que o listener privado ainda responde 403 anônimo sem acessar nenhum provedor. Executar também `npm test` e os seis workflows da HEAD exata.

**Limites:** a declaração `inspect()` pertence ao adaptador injetado, não é prova independente de ledger nem de identidade da imagem Docker. A última leitura da cerca e o envio pelo socket continuam não atômicos. A instalação R95 na VPS, o vínculo PID/porta/HTTP e a reconciliação de custos da OpenAI não foram verificados. Revisões AppSec/LGPD/FinOps/editorial permanecem gates. Sem segredo, dado real, deploy, merge, DNS, VPS, CRM/Portal/Sites, operação pública ou novas chamadas pagas. `main`, mascote e `publicFaiscaEnabled=false` preservados. **NO-GO público.**
