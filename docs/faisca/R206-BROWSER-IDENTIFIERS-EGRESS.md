# Faísca R206 — proteção independente no navegador para identificadores e homógrafos

**Base fixada:** R205 #683, HEAD `8ddd2cb82696fd28adb0be20e6937273938469e8`, CI 5/5 aprovada. Todos os testes são exclusivamente privados e sintéticos. Nenhuma credencial real é utilizada.

## Alteração

A interface privada já recusava valores monetários, garantias, números e operações fabricadas. A R206 fecha uma lacuna específica no último limite de apresentação: **uma resposta HTTP 200 falsificada com proveniência Luna/Terra válida ainda podia incluir termos de identificadores pessoais ou caracteres de outro alfabeto** antes de chegar a `textContent`.

- `privateBrowserGeneratedIdentifierRisk` barra, no navegador, termos de CPF/CNPJ, senha/token/OTP, dados bancários e contatos, bem como letras não latinas visualmente confundíveis, nas respostas geradas (`general_answer` e `draft_answer`).
- Respostas editoriais estáticas (`editorial_answer`) e confirmação fixa permanecem ligadas ao texto e às fontes verificadas, sem alteração das receitas aprovadas.
- Chromium intercepta HTTP 200 sintético, verifica bloqueio sem renderização, sem novo despacho de IA, limpa token/pergunta/confirmação, e mantém um controle positivo para a orientação geral fictícia.
- Node/HTTP em loopback verifica 503 genérico em três saídas inseguras e 200 na saída segura; o adaptador de IA é um objeto simulado, sem rede externa.

## Execução de revisão

```bash
node --test tests/faisca-r206-private-identifier-egress.test.mjs
node --test tests/faisca-*.test.mjs
node ops/faisca/openai/private-conversation-browser-qa.mjs
```

**Gates:** verificar 6 workflows da CI na HEAD da PR draft antes de afirmar aprovação. Isso não demonstra que R95–R206 está instalado na VPS. Sem chave, sem chamadas pagas, sem produção, sem dados reais, sem merge, sem DNS, sem CRM/Portal/Sites e com `publicFaiscaEnabled=false`. O filtro lexical não substitui revisão editorial, proteção LGPD completa, homologação operacional nem reconciliação de consumo. O mascote aprovado e o site público não são modificados.
