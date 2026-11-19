# Faísca R37 — passar a solução qualificada para o simulador Comercial (somente revisão privada)

**Base:** [Faísca R36 #500](https://github.com/rafhael100/imagine-comercial/pull/500) — seis workflows verdes.  
**Escopo:** integração de experiência em staging local protegido com Basic Auth, sem checkout, lead, CRM, Portal, dados pessoais ou operação externa.

## Resultado funcional

O cliente de revisão podia concluir as perguntas do Faísca enquanto permanecia na homepage comercial, mas ainda precisava selecionar novamente a solução no simulador Onepage/Landing Page. A R37 implementa uma **passagem explícita e mínima**, sem trocar a escolha automaticamente:

1. O revisor abre **Testar o Faísca dentro do site** na homepage comercial privada.
2. Confirma o serviço e responde às cinco perguntas de qualificação.
3. Só após conclusão, o runtime de interface coloca um atributo fechado no DOM do **iframe de revisão**: `data-faisca-quote-site=onepage` ou `data-faisca-quote-site=landing-pages`. O valor provém exclusivamente do perfil **R08 confiável**; a preferência de contato, as respostas, a identidade e qualquer texto livre nunca aparecem nesse atributo.
4. Ao clicar **Levar escolha ao simulador (sem envio)**, o novo script de revisão `quote-bridge.mjs` lê esse valor **na mesma origem privada**, valida a enumeração, encontra o seletor de serviço existente no Comercial e aciona o botão correspondente. Não escolhe tier, pagamento ou preço, não cria pedido, não abre WhatsApp nem transmite dados por rede.
5. O revisor recebe confirmação visível e foco no simulador; pode revisar a estimativa e escolher seu caminho normalmente. O checkout público continua NO-GO.

Antes da conclusão, depois de reset, com iframe ausente ou com valor adulterado, o botão recusa a transferência. O simulador continua independente da disponibilidade do Faísca.

## Implementação

- `ops/faisca/ui.mjs`: publica no DOM só o serviço **concluído e validado**; remove o atributo em qualquer estado incompleto e ao destruir a interface.
- `ops/faisca/composition/quote-bridge.mjs`: JS cliente curto, sem imports, fetch, cookies, storage, rede, postMessage ou preço; aceita unicamente os dois valores permitidos e exige clique real do visitante.
- `src/lib/private-loopback-preview.mjs`: controle de passagem e aviso acessível dentro do `details` privado, script próprio servido sob a mesma autenticação Basic; não altera `src/pages/index.astro` nem o `dist/index.html` público.
- `ops/faisca/composition/commercial-preview.mjs`: carrega do commit revisado apenas o script permitido `/__faisca_preview/quote-bridge.js`; rota e tamanho são restritos, sem endpoint de escrita.
- `ops/faisca/composition/build-portable.mjs`: inclui o mesmo script revisado no artifact R29 portátil, sem exigir repositório/npm no computador do revisor.
- Testes R24 e Chromium R24/R29: autenticação da rota, recusa anônima, qualificação incompleta, valor adulterado, passagem Onepage após cinco respostas, preservação dos CTAs e do checkout bloqueado, reinício e zero rede externa. Os demais testes de PHP R06, privacidade, SEO e build público permanecem ativos.

## Critérios de aceite

CI verde **na SHA exata desta PR**, incluindo o pacote portátil R29, navegador real, gate R26 de ausência de assets do Faísca no build público e regressões R27–R36. O atributo de serviço não constitui identificação, autorização de contato, consentimento de contrato ou garantia de preço; a seleção fica somente no navegador.

## Pendências para venda real

O próximo passo operacional continua exigindo Portal em staging autenticado, tier escolhido conscientemente pelo comprador, preço e termos no servidor, aceite do contrato, pedido persistido e retorno validado; após isso, PSP/Sites e suporte autenticado têm gates próprios. A IA generativa real ainda exige provedor, privacidade, custos duráveis e segurança. Nenhuma parte da R37 os habilita.

**Sem merge na main, deploy, DNS, VPS, cobrança, lead real, dados pessoais ou alteração da imagem original aprovada do Faísca.**
