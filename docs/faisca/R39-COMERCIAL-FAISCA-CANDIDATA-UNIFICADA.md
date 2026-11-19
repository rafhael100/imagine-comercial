# Faísca R39 — candidata unificada com o Comercial F357, sem merge na main

**Base:** [Faísca R38 #502](https://github.com/rafhael100/imagine-comercial/pull/502), HEAD `0c7fa2297f1566c86f0b97eaf6d8a877adae5a10`, com seis workflows verdes.  
**Comercial paralelo:** [F357 #490](https://github.com/rafhael100/imagine-comercial/pull/490), HEAD `3adc79ff6ea78f1d4a629101ce85cf7cc1bedbd2`.  
**Status:** composição em branch de integração **draft**, revisão obrigatória, sem publicação.

## Problema de integração realmente resolvido

O Comercial F357 e o Faísca R38 avançaram em árvores divergentes desde o ancestral comum `a4f4eb9687b6dfd9c0d45e88e8345cc37198cd6e`.

A comparação de **todos os blobs** Git identificou **33 arquivos alterados pelo Comercial** desde esse ancestral:
- **29** podiam ser importados porque no Faísca ainda eram idênticos ao ancestral;
- **1** já era byte-idêntico à versão Comercial;
- **3** tinham alterações nos dois lados: `scripts/browser-qa.mjs`, `src/components/CommercialChoicePreview.astro` e `tests/reviewed-quote-contact.test.mjs`.

Os três conflitos envolvem precisamente a correção de CTA desabilitado e centralização do WhatsApp da F357, que já haviam sido portadas para a linha Faísca na R28. Foram reconciliados **adotando os arquivos integrais mais recentes da F357**, inclusive as verificações do Comercial, para não perder evoluções paralelas.

## Composição de código realizada

Foi criada uma árvore Git a partir da R38, substituindo **32 blobs** pelas versões exatas da F357. Uma segunda comparação, feita antes do commit de merge, confirmou:
- exatamente 32 arquivos diferentes da R38, **todos** byte-idênticos à HEAD da F357;
- zero alterações em qualquer caminho `ops/faisca/`;
- presença integral de R37 (passagem segura ao simulador) e R38 (kit para staging privado);
- preservação da versão aprovada do PNG do mascote.

Commit de merge **somente em branch de revisão**:
`9ad6b95fe81b2f51453f70af897ece7a2979ff4a`.

Pais:
1. R38 `0c7fa2297f1566c86f0b97eaf6d8a877adae5a10`;
2. F357 `3adc79ff6ea78f1d4a629101ce85cf7cc1bedbd2`.

Assim, esta candidata reconhece **ambas as linhas como ancestrais**, em vez de meramente copiar alguns ajustes e deixar o Git divergente.

## Gate de integridade adicional

`ops/faisca/integration/f357-merge-manifest.json` registra os 33 caminhos comerciais e seus hashes de blob Git. `tests/faisca-r39-commercial-f357-merge.test.mjs` recusa qualquer arquivo do Comercial que não corresponda à versão revisada. Também verifica:
- que o Faísca permanece desligado no build público;
- que a fonte única WhatsApp atende três idiomas;
- que o CTA vazio impede navegação e o script privado Faísca não faz rede nem cria pedido;
- que a imagem original do Faísca não foi alterada.

## Próximo gate técnico

A **SHA final** desta PR deve passar no mesmo commit por:
- Faísca, demonstração/navegador, R26 ausência de assets privados no `dist`, R27 falha de módulo, R37 transferência explícita e R38 kit offline;
- PHP pinado, PostgreSQL descartável e contrato Onepage pinado do Portal;
- **workflows do Comercial F357** (orçamento, SEO/build/Chromium, continuidade das páginas legadas, políticas de staging e segurança), adicionados pela árvore comercial.

Se uma nova regra comercial divergir, corrigir na própria branch R39 antes de preparar staging. Não mover a `main` ou fazer deploy só porque a CI está verde.

## Estado ainda não operacional

O build continua sendo candidato de **staging privado**, não serviço ativo. Para liberar vendas são necessários: revisão independente AppSec/DBA/LGPD, ambiente Leaseweb realmente protegido por HTTPS/IAM/túnel, backup/restauração, aprovação do provedor IA e orçamento durável, pedido Onepage autenticado no Portal com termos e preço próprios, CRM/Sites, testes ponta a ponta de pagamento e GO de publicação.

**Nenhuma operação de produção, DNS/VPS, custo, credencial, cliente real, cobrança ou alteração do mascote foi realizada.**
