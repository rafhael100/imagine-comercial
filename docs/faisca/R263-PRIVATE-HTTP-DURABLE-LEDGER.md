# Faísca R263 — conversa privada + reserva durável real (DRAFT)

Base: R262 #741, SHA `ff415bdfc30a20a93f471c390ab9080c53ba3eb0`.
A R95 #570 permanece aprovada em sua HEAD; sua instalação na VPS **não foi observada** por este incremento.

## Evidência executável

`node --test tests/faisca-r263-private-http-durable-ledger.test.mjs`

Este teste conecta **o servidor HTTP privado R95 verdadeiro** a **um ledger R82 real em diretório temporário 0700**, com as duas respostas Luna/Terra inteiramente simuladas. Não exige nem acessa a chave da OpenAI. Verifica:

1. POST sem token, entrada com e-mail fictício e pergunta de preço editorial são recusados ou respondidos sem gerar reserva nem chamada à API.
2. Uma pergunta geral inteiramente fictícia faz uma requisição simulada por modelo e é devolvida com a proveniência e as proibições de operações públicas; os payloads simulados usam `store:false` e `tools:[]`.
3. O ledger registra **duas reservas duráveis** em disco, sem gravar textos de perguntas, respostas, identificadores sintéticos ou credenciais fictícias. A entrega HTTP concluída libera o marcador somente depois do ACK de resposta.
4. Uma instância independente do ledger lê os mesmos contadores após o fechamento do HTTP. A capacidade de duas solicitações foi consumida: o próximo processo não pode despachar novamente.
5. Uma resposta de provedor simulada com HTTP 503 conserva uma reserva, cria o marcador permanente de resultado incerto e impede novos despachos após reinicialização. Sem reembolso implícito ou repetição automática.

A verificação é local e não confirma cobrança efetiva, correspondência com extrato OpenAI, limite de cobrança do provedor, autenticação independente de processos Docker, nem implantação em staging. A contagem é apenas de **reservas estimadas** e o arquivo high-water fornece proteção local limitada contra rollback acidental. A proteção não equivale a um livro externo confiável.

## Gates ainda fechados

- CI na HEAD exata (Node/HTTP, Chromium/axe/WCAG, SEO/build, Portal/Onepage, PostgreSQL descartável e PHP).
- Instalação operacional R95–R263 na VPS, imagem/digest Docker e propriedade dos listeners, a verificar somente com autorização de acesso própria e evidências diretas.
- Conciliação independente de consumo/faturamento, privacidade/LGPD, revisão AppSec e decisão editorial.
- **NO-GO público**: `publicFaiscaEnabled=false`. Sem merge, deploy, DNS, clientes reais, CRM/Portal/Sites operacionais, chaves novas ou chamadas pagas.

O teste pago Luna/Terra e a homologação R92 anteriormente relatados não são repetidos.
