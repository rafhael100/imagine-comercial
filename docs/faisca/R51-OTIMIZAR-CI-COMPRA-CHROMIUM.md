# Faísca R51 — acelerar o teste de compra F325 sem reduzir a cobertura

**Base:** candidata consolidada [Comercial + Faísca R50 #504](https://github.com/rafhael100/imagine-comercial/pull/504), SHA `1abad8f2d4f968e5d6559a764d1bc97cabd041ed`. **Status:** PR de manutenção CI, sem deploy, sem alteração de produto.

## Problema observado

A verificação F325 de compra navegável é um dos últimos gates de CI da candidata consolidada. Ela executava incondicionalmente:

```bash
npx playwright install --with-deps chromium
```

Esse comando aciona preparação de dependências nativas em toda execução, mesmo quando a imagem temporária do GitHub já possui as bibliotecas exigidas para executar Chromium. A preparação acrescenta tempo e cria dependência desnecessária de repositórios de pacotes externos. O repositório Imagine Comercial já contém um script **F161** aprovado, com verificação de lançamento real do navegador e fallback para instalar bibliotecas somente quando o teste inicial falha.

## Alteração

A R51 troca **apenas** a etapa de bootstrap em `.github/workflows/comercial-f325-buyer-journey.yml` por:

```bash
bash scripts/install-chromium-ci.sh
```

O F161 executa `npx playwright install chromium`, tenta abrir e usar o navegador sem `apt`; se houver problema de biblioteca e **somente dentro do GitHub Actions**, instala as dependências com `npx playwright install-deps chromium`, tenta iniciar novamente e mantém a CI vermelha caso o navegador ainda não funcione. Portanto, nenhum cenário de browser é pulado.

Os gatilhos do workflow também incluem mudanças no script F161 e no novo teste de contrato `tests/comercial-f325-browser-bootstrap.test.mjs`. O ensaio verifica que actions continuam imutavelmente pinadas, credenciais não são persistidas e a entrega F325 permanece **artifact de revisão**, sem deploy/checkout/pagamento.

## Benefício e limites

O trabalho **pode reduzir o tempo de instalação e riscos transitórios de rede**, mas não deve ser apresentado como otimização quantificada sem comparar duas execuções completas. O gate funcional F325, as capturas de 375/1440 px e os testes de ausência de rede externa continuam inalterados.

Antes de compor esta PR à candidata R50, exigir CI na SHA exata, incluindo F325 em Chromium e a suíte comercial completa. Nenhuma alteração de mascote, páginas públicas, dados reais, cobrança, IA externa, Portal/CRM, DNS, VPS ou `main`.
