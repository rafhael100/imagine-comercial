# Faísca R149 — privacidade de domínios internacionalizados e pontos Unicode

## Risco identificado

O filtro R148 reconhece domínios ASCII sem protocolo, IPv4 e IPv6, porém nomes IDN que contêm letras de outros alfabetos (inclusive homógrafos cirílicos) e alguns separadores de ponto Unicode podem escapar. Exemplos **sintéticos**: `loja.exemplо` (última letra cirílica), `loja.例子`, `loja。example`, `loja․example`, `10。0。0。1`. O caractere de ponto ideográfico U+3002, por exemplo, não é convertido em ponto ASCII por NFKC.

## Correção privada

- A verificação autoritativa de `private-identifier-risk.mjs` reconhece rótulos DNS Unicode por propriedades de letras/números, e converte apenas **para a análise** os separadores U+3002, U+2024 e U+2027 em ponto ASCII.
- A interface privada faz o mesmo em **duas barreiras independentes**: preflight antes do POST e egress antes de escrever `textContent` no navegador.
- A normalização não transforma nem retorna textos do operador, não faz lookup DNS e não permite encaminhar perguntas rejeitadas para o provedor. Respostas rejeitadas não geram retry e não devolvem reservas de chamadas já consumidas.
- Testes executáveis `tests/faisca-r149-private-idn-unicode-dot.test.mjs`: classificação e pergunta fictícia, modelo Luna/Terra com `fetchImpl` sintético, HTTP autenticado somente em loopback, JavaScript real da interface via VM com HTTP 200 forjado e controle positivo. A CI ordinária verifica Node, Chromium/axe/WCAG, CSP, Portal/Onepage, PostgreSQL descartável e Comercial/SEO/build.

## Limites e gates

O filtro continua sendo um **controle lexical conservador**, não um DLP completo nem uma homologação LGPD. Podem existir outras codificações, homoglifos ou identificadores sensíveis que escapem. A verificação não substitui AppSec, revisão editorial humana ou homologação de staging. R92 e teste pago privado Luna/Terra foram relatados concluídos pelo operador; não repeti-los nem presumir R95+ implantada na VPS.

**NO-GO público**: revisão privada e PR draft apenas; preservar mascote, site, `main` e `publicFaiscaEnabled=false`. Sem deploy, DNS, VPS, credenciais, dados reais, operação CRM/Portal, lead, ticket ou cobrança. O teste pago só poderá ocorrer em ambiente de desenvolvimento autorizado com credenciais provisionadas de forma segura, controle contra loops e sem copiar segredos.
