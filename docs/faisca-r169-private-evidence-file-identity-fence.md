# Faísca R169 — identidade de arquivo na auditoria offline (REVIEW ONLY)

## Motivação
A R168 lia cada evidência duas vezes e comparava o JSON, mas duas observações com bytes idênticos não detectavam substituição do arquivo por outro inode. Além disso, `readFile()` podia carregar mais bytes que o limite inicial em caso de crescimento simultâneo, e a abertura `O_RDONLY` de um FIFO sem escritor poderia bloquear o operador.

## Alteração
- Mantém os três nomes fixos, a pasta privada 0700, arquivos 0600, JSON canônico e o limite de 1.024 bytes por arquivo.
- Leitura no máximo de 1.025 bytes, por deslocamento explícito; cada arquivo é confrontado com `fstat` antes e depois da leitura.
- Exige `nlink=1` para recusar hardlinks e compara `dev/ino/mode/uid/gid/nlink/size/mtimeNs/ctimeNs` nas duas passagens. A pasta também deve conservar sua identidade e metadados.
- Exige `O_NOFOLLOW | O_NONBLOCK` para rejeitar symlinks e arquivos especiais sem bloquear em FIFO; recusa plataformas sem esses controles em vez de enfraquecer a garantia.
- Os erros continuam com mensagem fixa sanitizada, sem caminhos nem fragmentos de documentos. Não grava extratos, não acessa APIs e não modifica saldo/ledger.

## Testes sintéticos
`node --test tests/faisca-r169-private-offline-file-identity.test.mjs` e `npm test`. Testam evidência normal, hardlink, arquivo grande e FIFO sem escritor em Linux. CI mais ampla deve cobrir HTTP/Chromium/axe, Onepage/Portal, PHP, PostgreSQL descartável e Comercial/SEO/build **na HEAD exata**.

## Limites / gates
A leitura continua **não atômica**: substituições coordenadas entre observações, alterações por agentes com controle do host ou evidências fabricadas podem escapar. Não há assinatura de origem OpenAI, faturamento independente, autenticação de operador, relatório de produção, teste pago, nem GO. Uma diferença detectada bloqueia; contagens compatíveis significam apenas `COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW`.

R92 e testes pagos anteriores são etapas já relatadas pelo operador, não repetidas aqui. Homologação acumulada R95+ em staging privado, conciliação externa e revisão independente AppSec/LGPD/FinOps/editorial permanecem pendentes. **Sem merge, deploy, VPS/DNS, dados reais, CRM/Portal/Sites operacional, chave OpenAI, lead/ticket ou cobrança.** Preservar o mascote, o site público, `main` e `publicFaiscaEnabled=false`.
