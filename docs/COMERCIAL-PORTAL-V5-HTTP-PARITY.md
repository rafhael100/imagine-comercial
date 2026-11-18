# Comercial → Portal V5: quatro CTAs e pedidos por proprietário

## Lacuna fechada

A paridade V5 existente conferia os valores offline. A prova HTTP anterior
usava outro candidato do Portal, com regras históricas de Performance e
Sandbox. Ela não demonstrava os quatro CTAs do Comercial chegando ao catálogo
V5 por cadastro/login, com os pedidos persistidos para o cliente correto.

Esta prova adicional usa o Portal
`82deeb0062f80f1cf979a2c0105d394c2b1adc23`
([PR #932](https://github.com/rafhael100/imagine-portal/pull/932)), que preserva
produto e canal visual durante a troca de sessão no cadastro/login. O canal
não preenche orçamento e não concede autorização financeira.

Os pins anteriores do signer, HTTP histórico, contrato entre repositórios e
paridade V5 offline permanecem independentes. Este ensaio não os substitui.

## Entrada e valores conferidos

O navegador lê o HTML Astro compilado com
`IMAGINE_ASTRO_PRIVATE_PORTAL_PREVIEW=1`, verifica as quatro URLs HTTPS originais
e troca somente sua origem no DOM descartável por `http://127.0.0.1:18083`.
O caminho e a query vêm dos links reais. Nenhum arquivo publicado é reescrito.

| CTA | Caminho e query preservados | Quote aprovado |
| --- | --- | --- |
| Onepage | `/_preview/portal/shop?product=onepage` | R$ 990 em três parcelas de R$ 330 |
| Landing Page | `/_preview/portal/shop?product=landing-pages` | R$ 1.290 em três parcelas de R$ 430 |
| Google Ads | `/_preview/portal/shop?product=performance&channel=google_ads` | Mídia de R$ 1.000; ativação de R$ 490; gestão estimada de R$ 200 |
| Meta Ads | `/_preview/portal/shop?product=performance&channel=meta_ads` | Mídia de R$ 700; ativação de R$ 490; gestão estimada de R$ 170 |

Para os sites, as parcelas seguem D0/D30/D60 do aceite e a mensalidade
obrigatória de R$ 79,90 começa em D90, independentemente da publicação. Para
Performance, a mídia é paga à plataforma e a gestão é apurada após o mês civil;
o ensaio não cria uma cobrança real.

O digest independente do catálogo aprovado é
`75aab147df8d937f6f0630c92eec8b4783dc345e308292abe7706bcb31a905fa`.
Ele precisa coincidir com o catálogo PHP, o `offer_version` do formulário e
os cinco snapshots completos gravados pelo servidor.

## Evidência exigida pela CI

O workflow `comercial-portal-v5-http-parity.yml` exige o seguinte:

- Os contratos offline V5 e a matriz de seleção de 48 combinações passam
  contra a mesma SHA do Portal usada pelo navegador.
- O CTA Google anônimo passa pelo link real de cadastro; o CTA Meta passa por
  logout/login. Produto e canal são conferidos imediatamente após essas
  transições, antes de qualquer navegação que pudesse recompor o contexto.
- Ambos os orçamentos permanecem vazios até o preenchimento explícito pelo
  teste. Onepage e Landing não retêm um canal anterior.
- Um cliente sintético cria os quatro pedidos. Outro cliente, com a mesma
  empresa fictícia, cria seu próprio pedido Google como controle positivo.
  Cada painel lista somente seus pedidos, inclusive depois de novo login.
- Google de R$ 700 e campos financeiros injetados são rejeitados com 422.
  Leituras e alterações dos pedidos estrangeiros são rejeitadas com 404.
- O Sandbox de Performance e Landing permanece indisponível com 409.
  Nenhuma intenção de pagamento é criada, inclusive para Onepage.
- O PostgreSQL 18 confirma cinco snapshots completos, dois proprietários
  distribuídos em 4/1, estado pendente, revisão zero e ausência de briefing.
  A RLS obrigatória aceita o contexto assinado legítimo e nega contexto sem
  assinatura, MAC transferido, identidade administrativa forjada e atualização
  dos quatro pedidos estrangeiros. Os probes terminam em `ROLLBACK`.

## Execução e limites

A execução completa ocorre em um runner GitHub hospedado e descartável. O
Python exige `GITHUB_ACTIONS=true`, `RUNNER_ENVIRONMENT=github-hosted` e
`IMAGINE_CROSSREPO_V5_LOOPBACK=1`; o SQL exige PG18 e a base
`portal_purchase_rehearsal`. Os schemas e a RLS nativos são instalados antes
da primeira requisição HTTP. Aplicação e banco não expõem portas no host; o
gateway fica em loopback e o navegador bloqueia destinos externos.

O teste usa cadastro e sessão reais da demonstração privada, com pessoas
fictícias. Ele não comprova MFA ou identidade de produção, Google/Meta reais,
provisionamento, conversão, cobrança ou liberação operacional. Nenhuma
credencial de PSP é fornecida e nenhum worker de cobrança é iniciado.

A CI remove somente sua stack e volumes descartáveis. O resultado pertence à
SHA testada e deve ser registrado na PR. Build público, autenticação,
catálogo, preços e gates de checkout continuam sujeitos aos contratos de suas
respectivas fontes; merge, deploy e ativação de ambiente exigem a autorização
operacional já prevista no projeto.
