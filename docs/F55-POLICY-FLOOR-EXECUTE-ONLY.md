# F55 — API PostgreSQL de execução restrita, sem escrita direta nas tabelas

A F54 testava um piso de confiança monotônico em PostgreSQL real, porém sua identidade de aplicação precisava receber `INSERT/UPDATE` diretamente na tabela de segurança. A F55 adiciona a opção **execute-only**: duas funções PostgreSQL `SECURITY DEFINER` de dono privilegiado, com `search_path` fixo, nomes de tabelas qualificados, `EXECUTE` revogado de `PUBLIC` e um papel de aplicação com **apenas** `EXECUTE` nas funções, sem `SELECT/INSERT/UPDATE/DELETE` nas tabelas.

A primeira função promove a versão autenticada da política. A segunda vincula numa operação transacional a versão e o nonce, evitando downgrade e replay entre conexões concorrentes. O JS `createExecuteOnlyPolicyFloorClient(db)` só encaminha as duas consultas revisadas do F54 para chamadas parametrizadas das funções; qualquer outro SQL é recusado.

No CI GitHub-hosted, a migração `003-execute-only-policy-floor.sql` só é aplicada à base descartável de teste, seguindo F51–F54, e o papel restrito recebe grants explícitos apenas para os dois comandos. Testes positivos demonstram promoção, assinatura e concorrência; testes negativos recusam consultas diretas à tabela ou `DELETE` pelo papel.

**Limite:** a função no PostgreSQL não verifica Ed25519 sozinha; a aplicação deve validar a assinatura da raiz e a política F45 antes de chamar. Se a aplicação for comprometida, `EXECUTE` ainda pode ser abusado para elevar falsamente uma sequência e causar bloqueio (DoS), mas não para fazer rollback ou apagar as tabelas pelo papel. Chaves, canais remotos de revogação, segurança do servidor Leaseweb, backup e autenticação real do Portal continuam fora do escopo do CI. Não houve migração da VPS, deploy, DNS ou gastos.
