# F228 — CLI privada da auditoria de hosts/rotas (sem rede)

A F227 criou uma matriz completa de rotas atuais e 27 URLs historicas para os quatro hosts. A F228 oferece um comando local para avaliar **observações fornecidas pelo operador**:

```sh
node scripts/review-host-route-staging.mjs --synthetic
node scripts/review-host-route-staging.mjs --file /pasta/privada/host-route-observations.json
```

O arquivo JSON deve conter uma lista exata e completa de objetos com campos: `origin`, `path`, `status`, `location` (string ou null), `tlsValid` (booleano ou null), `noindex` (booleano ou null). Obter evidências HTTP somente no staging privado, com túnel/autorização adequados, sem dados reais de cliente.

- Abre arquivo por descritor único, rejeita symlink, mais de 1 MiB, UTF-8 invalido e formatos não previstos.
- `--file` é proibido em GitHub Actions e **nunca** grava evidências em `artifacts/` ou no repositório; stdout mostra apenas totais e flags que negam publicação.
- Código de saída 0: contrato offline conferiu; 1: divergências no contrato; 2: entrada recusada.
- O comando não consulta internet, não configura DNS/301 e **não aprova staging real, migração SEO ou go-live**.

Amostras sintéticas servem exclusivamente para testar o parser e o contrato. Operação de produção continua sob revisão SEO/GSC, segurança, inventário de caminhos, aceite e plano de rollback.
