# Faísca R121 — desconexão do cliente privado durante chamada potencialmente paga

## Risco e correção

Na revisão R120, o servidor impedia chamadas paralelas e continha timeouts, mas uma aba/cliente HTTP que desistisse de receber a resposta durante uma chamada ao provedor poderia deixar a sessão novamente disponível depois que o provedor concluísse. O consumo financeiro e o recebimento da resposta pelo operador tornam-se incertos nessa situação.

O endpoint privado em loopback agora observa a interrupção prematura da resposta **após** iniciar um despacho ao provedor, mantém o circuit breaker `providerUnavailable=true` e recusa novos POSTs pagos com HTTP 503 até o operador revisar e reiniciar conscientemente. Antes de despachar, também verifica se o cliente já desapareceu; nenhuma nova chamada é enviada nesse caso. Fechamentos normais após `finish` não bloqueiam a sessão.

## Evidências esperadas

- `node --test tests/faisca-r121-private-http-client-disconnect.test.mjs` usa HTTP real em `127.0.0.1`, um cliente que destrói o socket, duas modalidades (pergunta fictícia livre e caso fixo), provedores inteiramente sintéticos e uma promessa atrasada.
- Confirma `503` em tentativas posteriores, uma única chamada injetada, circuito persistente mesmo após conclusão tardia, e não depende do deadline do provedor para acionar a proteção.
- A CI empilhada deve continuar executando Node, Chromium/axe, revisão HTTP, SEO, Portal e PostgreSQL descartável. Nenhuma credencial, dado real ou chamada paga é necessária.

## Limites

O mecanismo é **local ao processo do servidor privado**. Não substitui ledger durável nem limite oficial de faturamento; falhas de processo podem requerer conciliação manual de reservas. Uma desconexão também pode negar novas chamadas mesmo se o provedor tiver concluído com sucesso, por escolha conservadora. A ausência de entrega ao navegador não prova ausência de cobrança.

R92 homologada conforme relato do operador; não há evidência de instalação R95–R121 na VPS nesta entrega. Não há GO público, deploy, merge, DNS, alterações VPS, uso de segredos, Portal/CRM operacional, ticket ou cobrança. Preservados mascote, site comercial e `publicFaiscaEnabled=false`.
