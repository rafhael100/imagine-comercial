# Faísca R143 — cerca de persistência do ledger de gastos locais

## Falha de segurança encontrada
O ledger R82/R130 usava `O_EXCL`, mas não sincronizava a criação do lock no diretório. O bloco `finally` removia incondicionalmente o lock mesmo quando a leitura do estado ou uma operação de persistência falhasse. Em falhas de I/O e perda de energia, um processo posterior poderia encontrar contadores antigos sem o lock persistido, criando risco de consumir cotas novamente.

## Correção
- Sincronizar arquivo de lock e diretório **antes** de ler e modificar o estado de reservas, usando `FileHandle.sync()`.
- Liberar lock só após gravação do estado, `fsync` do arquivo, `rename` e `fsync` do diretório concluídos. Após remoção do lock, sincronizar novamente o diretório.
- Em qualquer falha de integridade ou persistência potencialmente ambígua, **manter o lock** para bloqueio conservador até reconciliação humana, sem recuperação automática.
- Uma rejeição simples por cota insuficiente não modifica estado e libera o lock normalmente.
- Não armazenar prompt, resposta, modelo, segredo, PII ou qualquer dado do cliente no ledger.

## Provas e escopo
`node --test tests/faisca-r143-durable-lock-crash-fence.test.mjs` cobre reservas sequenciais, preservação entre instâncias, rejeição por limite, corrupção de estado e marcador parcial sem reset. A CI deve executar suites Node/HTTP/Chromium/axe, Comercial/SEO, Portal/PHP e PostgreSQL efêmero.

**Limitações:** testes Node exercitam o fluxo de `fsync` mas não simulam desligamento elétrico, falhas reais de disco ou fsync indisponível. O bloqueio continua **single-host**: não garante teto global da OpenAI, nem orçamento distribuído entre VPS. O operador deve reconciliar Usage/API antes de remover lock manualmente; não há permissão de limpeza automática, leitura de chave, deploy, nem declaração de staging homologado.

R92 já homologada segundo operador. R95 e esta candidata não presumidas instaladas. `main`, mascote, site público e `publicFaiscaEnabled=false` não mudam. **DRAFT / REVIEW ONLY; NO-GO público**. Sem merge, VPS/DNS, APIs externas, CRM/Portal operacional, lead, ticket ou cobrança.
