# F47 — E2E offline do pacote protegido com witness

A F47 conecta os controles existentes em uma única operação de revisão: F38 verifica os bytes reais da árvore Astro contra um SHA-256 confiável separado; F45 valida a política assinada pela raiz, a assinatura Ed25519 do witness, sua janela de validade e o ledger anti-replay F41; F40 cruza identidade, release, alvo e hash.

**Ordem de operações:** primeiro validar o pacote, depois consumir o nonce do recibo. Um pacote adulterado não deve inutilizar um recibo autêntico. O resultado final declara explicitamente `deploymentAuthorized=false` e `deploymentPerformed=false`.

O teste E2E foi acrescentado ao fluxo sintético `scripts/test-build-catalog.mjs`, com build Astro real, catálogo assinado efêmero e política/witness efêmeros. É um teste local sem rede. O SHA-256 fornecido nesse teste provém do próprio fluxo sintético; **não constitui pin independente no mundo real**.

Para uso real ainda faltam: pin/out-of-band de release, raiz e sequência monotônica de um serviço independente, witness que leia os bytes entregues na hospedagem, ledger transacional persistente, IAM/MFA, aprovação humana e staging privado. Nenhum teste produz recibo remoto real, deploy ou alteração de DNS, main e produção.
