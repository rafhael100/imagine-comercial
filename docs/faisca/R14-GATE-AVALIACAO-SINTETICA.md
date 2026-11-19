# Faísca R14 — gate de qualidade e segurança com cenários sintéticos

**Escopo:** continuidade da R13 (#476), em branch filha e PR draft.  
**Objetivo:** impedir regressões em rotas comerciais, dúvidas privadas, privacidade e abstenção antes de conectar qualquer IA externa.

## O que a CI avalia

O corpus `ops/faisca/evaluation/scenarios.mjs` possui **24 perguntas sintéticas fechadas**:
- 11 de pós-venda privado, que precisam de orientação fixa com autenticação;
- 3 de orientação local (atendente, privacidade e CRM não homologado);
- 6 de vendas públicas, que devem usar respostas fundamentadas do catálogo editorial;
- 1 assunto sem resposta verificada, que exige abstenção;
- 3 entradas potencialmente sensíveis ou tentando burlar instruções, que exigem recusa.

O avaliador `ops/faisca/evaluation/run.mjs` compara o núcleo guiado, o roteador R09 e, para dúvidas de pós-venda, a fronteira de conhecimento R06. Qualquer divergência de intenção, rota, fonte ou tratamento privado produz falha.

## Evidência e privacidade

O relatório `faisca.evaluation.synthetic.v1` contém apenas identificadores dos cenários, contagens de aprovados/reprovados e códigos estáveis de falha. Não contém textos enviados, transcrição, e-mail, telefone ou credencial sintética.

O workflow `Faísca - demonstração guiada e acessibilidade` executa:

```bash
node --test tests/faisca-*.test.mjs
node ops/faisca/evaluation/run.mjs --synthetic > ops/faisca/reports/FAISCA_R14_EVALUATION_SYNTHETIC.json
```

A avaliação falha (exit code 1) se qualquer caso reprovar; resultados são guardados no artifact de CI sintético para revisão. Não usar dados reais ou carregar transcrições para esse script.

## Aceite e limitações

- 24/24 fixtures **devem** passar na SHA revisada; ainda assim, isso não representa acurácia em conversas abertas, benchmark de IA, segurança completa, LGPD homologada ou autorização de produção.
- Nenhuma API externa, provedor real, voz, pagamento, CRM, Portal, e-mail, envio de resumo ou armazenamento de dados de clientes é acionado.
- Precisa de revisão humana/independente e ampliação posterior para diálogos multi-turno, ambiguidade, paráfrases, linguagem regional, dados mistos e abuso de sessão.
- O corpus e seus critérios não podem ser alterados simplesmente para tornar a CI verde sem explicação e revisão.
- Nada foi publicado em `main`, `src/`, `public/`, DNS, VPS ou site comercial.

**Gate:** somente laboratório; sem merge, deploy, custos ou integração real.
