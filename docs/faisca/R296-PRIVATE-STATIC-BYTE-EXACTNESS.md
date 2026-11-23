# R296 — Integridade exata de bytes do smoke privado

R94 exigia comparação exata, mas `TextDecoder` omite por padrão o BOM UTF-8 inicial. R296 compara `Buffer` diretamente com bytes UTF-8 esperados, sem decodificação. Preserva limites, cabeçalhos, digest do PNG aprovado, apenas GET em loopback, sem bearer ou modelo. Teste usa HTTP real local com prefixo BOM sintético em HTML/JS/CSS, com e sem conversa privada, além do caminho positivo.

Executar `node --test tests/faisca-r296-private-static-byte-exactness.test.mjs` e CI completa. Não prova que o processo, Docker ou SHA estão implantados na VPS; exige testemunha externa de implantação e revisão independente. Sem merge/deploy, dados reais, chaves, chamadas pagas ou GO público.
