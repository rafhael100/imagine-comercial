# Faísca R13 — linguagem natural para atendimento sem consultar dados de clientes

**Base:** R12 (PR #475), empilhada sobre R11 (PR #474).  
**Escopo:** laboratório sem IA externa e sem acesso operacional a clientes, pedidos, Portal ou CRM.

## Problema

A R11 reconhece dúvidas explícitas como "Qual o andamento do meu pedido?". Uma pessoa pode, porém, formular a necessidade com outras palavras: "Quero a segunda via da nota", "Tenho um problema no site que contratei" ou "Como entrar na área de cliente?". Antes da R13, algumas dessas perguntas ficavam sem orientação ou podiam cair numa resposta comercial genérica.

## Comportamento implementado

- O guia inicial do Faísca passa a reconhecer apenas padrões fechados, de alta confiança, em português brasileiro, relativos a segunda via de documento, estorno/reembolso, valor do plano **já contratado**, renovação, alteração de serviço, dificuldade técnica ligada ao serviço e acesso ao Portal/área do cliente.
- A intenção direciona para **orientação fixa** (autenticação ou canal oficial). Não presume que o visitante tem contrato, não verifica identidade, pagamento, status, ticket ou cancelamento.
- O R06 de conhecimento fundamentado respeita a classificação de fronteira privada do guia inicial. Dessa forma, uma pergunta sobre problema em um site contratado não recebe uma resposta pública genérica sobre vendas de Onepage.
- O roteador R09/R12 continua recusando a emissão dessas perguntas ao provedor e mantém respostas aprovadas para perguntas realmente públicas.
- A detecção de possíveis dados pessoais, senhas e injeções continua tendo precedência absoluta sobre os novos padrões.

## Matriz sintética de regressão

`tests/faisca-r13-support-language.test.mjs` exercita onze formas frequentes de dúvidas de pós-venda, verifica consistência entre núcleo guiado, R06 e R09, testa zero chamadas ao provedor simulado e preserva cinco perguntas públicas. Há uma prova negativa com dado de acesso fictício, que deve ser ocultado antes de qualquer resposta.

### Reproduzir no checkout isolado

```bash
node --test tests/faisca-r11-anonymous-boundary.test.mjs tests/faisca-r12-anonymous-runtime.test.mjs tests/faisca-r13-support-language.test.mjs
node --test tests/faisca-grounding-catalog.test.mjs tests/faisca-r09-grounded-pipeline.test.mjs
npm test
```

O CI deve ser observado **na SHA desta PR**. Os testes ainda não constituem revisão independente, certificação LGPD ou homologação operacional.

## Limitações deliberadas

O reconhecimento por expressão regular não é interpretação semântica completa; frases ambíguas continuam recebendo fallback seguro e não autorizam ações. A melhoria também não cria acesso autenticado ao Portal, consulta a CRM, segundo via real, ticket, criação de lead ou mensagens enviadas.

O PNG do mascote, sua identidade aprovada, as páginas públicas e o deploy estão fora do escopo. **PR DRAFT, sem merge, publicação, DNS, VPS, serviços pagos ou dados reais.**

## Próximas etapas

1. Revisão independente das mudanças em `core.mjs` e `grounding/guide.mjs`, observando colisões entre intenções de venda e suporte.
2. Avaliação de conversas multi-turno, incluindo troca de assunto, dados pessoais, latência, abstenção, sessão e reconciliação.
3. Homologação da identidade/autoridade do Portal antes de qualquer pós-venda autenticado, com MFA, grants, auditoria, retenção, revogação e recibos.
