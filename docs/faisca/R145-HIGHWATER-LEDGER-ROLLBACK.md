# R145 — testemunha local de máxima reserva e detecção de rollback

## Problema demonstrado
A R130 recusa JSON malformado e a R143 preserva um lock durável sob falhas ambíguas. Entretanto, uma cópia **anterior, perfeitamente canônica** de `faisca-reservations.json` poderia restaurar contadores menores sem violar a sintaxe ou os limites. Um único arquivo de estado não detecta essa restauração parcial.

## Incremento privado
- Cada reserva escreve primeiramente, sob o lock `O_EXCL` já sincronizado, uma testemunha local `.faisca-reservations-highwater.json` com os **mesmos contadores e limites** e esquema fixo `faisca.private-local-reservations.highwater.v1`.
- A testemunha e seu marcador de inicialização são gravados com permissão 0600; tanto o arquivo temporário quanto o diretório recebem `fsync`, e só depois o estado principal é atualizado e sincronizado.
- `ready()` e `reserve()` recusam testemunha ausente após a inicialização, escrita não canônica, permissões inseguras, limites distintos e contadores divergentes. Uma falha durante a reserva deixa o lock de revisão: não há desbloqueio ou reembolso automático.
- Estados R82/R143 íntegros **anteriores à R145**, sem testemunha nem marcador R145, permanecem legíveis; a primeira reserva futura estabelece a testemunha sem zerar os gastos acumulados.
- Os testes `node --test tests/faisca-r145-highwater-rollback.test.mjs` reproduzem rollback canônico do estado e da testemunha, exclusão, corrupção do marcador, persistência e migração de estado preexistente.

## Limites explícitos
Esta é uma defesa contra rollback **de um arquivo**, perda parcial e restauração indevida de snapshot local. **Não** é livro-caixa imutável, HMAC, contador de TPM, testemunha externa, limite global de faturamento, serviço multi-host ou prova contra quem controla todos os arquivos e seus marcadores. Um agente com acesso de escrita a toda a pasta pode manipular estado e testemunha. Para uso real, ainda exigir identidade e permissões operacionais, backup/reconciliação externa, limites de gasto do provedor, monitoramento e teste de recuperação com operador.

Não há migração automática da VPS. Ao homologar em staging, o operador deve revisar a cópia e o backup do diretório privado antes da primeira escrita. Bloqueio por divergência é **NO-START**, e não instrução para excluir o lock. A R92 já foi homologada pelo operador; R95+ não se presumem instaladas. Nenhuma chave, dado real ou chamada paga foi utilizada nesta PR. Sem main, merge, deploy, DNS/VPS, produção ou permissões para Portal/CRM. `publicFaiscaEnabled=false` e mascote aprovado preservados.
