# Comercial × SEO RC38 F98 — integração offline por SHAs fixos

**Objetivo:** validar a versão do SEO Engine com a proteção F98 contra auto-comparação de GSC por hardlinks, mantendo a auditoria técnica do Comercial inalterada.

- SEO F96 de referência: `329bbe34cb0fe67e599d02d6c28d0ce13ddeb475`.
- SEO F98 candidata: `50d56a6febc674fada8a04bbe513e7fddc62551d`.
- Execute a suíte Node 22 completa do motor F98 e as duas auditorias no **mesmo build real do Comercial**, exigindo igualdade de sumário, rotas, erros e alertas com `--strict-public-head --fail-on-warnings`.
- Execute o CLI de exportação CSV → Portal offline com dados 100% sintéticos: consulta permitida, privacidade Unicode, caminho `../` negado, **dois nomes físicos para o mesmo inode negados**, dois arquivos distintos de conteúdo idêntico permitidos, sem conteúdo/caminho privado nos logs.
- A identidade `device/inode` fica apenas no processo local; não entra no contrato de resumo do Portal e não autoriza leitura Google.

**NO-GO:** nenhum repin de auditor usado em produção, GitHub `main`, API Google, AuthN/AuthZ, dados reais, rede externa, DNS/301/Cloudflare ou deploy. Este é um teste de compatibilidade local, não autorização de publicação.
