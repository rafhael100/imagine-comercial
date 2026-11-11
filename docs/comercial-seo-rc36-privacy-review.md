# Comercial × SEO RC36 — Prova sintética de privacidade GSC

A [RC36 do motor SEO](https://github.com/rafhael100/imagine-seo-engine/pull/124) adiciona o filtro compartilhado de CPF/CNPJ da F85. Este lote testa **somente a diferença de privacidade** entre dois SHAs fixos:

- RC35 (baseline): `743e24d7b14ba27aa8534911034da0c26a71afee`.
- RC36 (filtro atualizado): `440d515c1094ed5c8e0094c5c614fe1d6d49d881`.

A CI usa uma exportação **inteiramente fictícia** com CPF e CNPJ formatados e uma consulta profissional pública. A RC35 classificava essas três consultas como analisáveis; a RC36 precisa contar as duas consultas de identificação como ocultadas e excluir cliques/impressões desses termos, preservando apenas os dados da consulta pública. Nenhuma consulta privada pode sair no JSON produzido.

A CI também confere os SHAs efetivos do Git, usa actions pinadas e não lê nenhum arquivo de clientes. **Não modifica** o `validate.yml` nem seu pin F81; o [Comercial #235](https://github.com/rafhael100/imagine-comercial/pull/235) já comprovou a paridade técnica do auditor RC35 contra o HTML do Comercial, e esta prova complementa com a privacidade RC36.

**NO-GO:** nenhuma conexão Google, OAuth real, acesso a clientes, migração, deploy, DNS, 301 ou merge main. Para atualizar o auditor do Comercial para a RC36, ainda são exigidos testes gerais, revisão independente AppSec/LGPD/SEO, rollback e aprovação explícita da release.
