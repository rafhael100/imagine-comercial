# Faísca R177 — anti-replay durável do testemunho de revisão (DRAFT, NO-GO)

Dependência: R176 #654. Implementação **exclusivamente offline**, sem acesso à VPS, credenciais, dados de clientes, Portal/Sites operacionais ou chamadas pagas.

## Problema

R175 verifica assinatura Ed25519 de revisão humana. R176 integra essa prova à auditoria numérica. Sem registro durável do nonce, a mesma revisão poderia ser reutilizada indevidamente. O testemunho assinado **não** é recibo da OpenAI, nem comprovação de cobrança, origem do extrato ou autorização pública.

## Novo gate R177

Quando as três entradas assinadas R176 são informadas, a CLI exige também a variável **independente** \`FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE_DIRECTORY\`. Ela deve apontar para um diretório ABSOLUTO, canônico, pré-criado pelo operador, de dono igual ao processo e permissões **0700**, em host POSIX privado. Não coloque essa pasta no checkout Git, no diretório de evidência, na VPS pública ou em artefatos de CI.

Após a leitura offline e a **segunda** verificação de checkout limpo/HEAD fixa, e **antes de emitir o relatório**, a CLI cria atomicamente um registro \`O_CREAT|O_EXCL|O_NOFOLLOW\`, com permissões 0600 e conteúdo literal \`consumed\`. O nome é um SHA-256 separado por domínio do nonce; o nonce original, testemunho, chave, prompt, ID de cliente e valores de conta não são gravados. Arquivo e diretório são sincronizados; mesmo após reiniciar o processo, a tentativa de reaproveitar o nonce retorna **BLOCKED**, sem imprimir informações privadas. Erro de permissão, concorrência, fsync ou registro existente também bloqueia.

No modo legado sem testemunho assinado, a CLI **não** consome nonce e continua identificando o resultado como \`independentReviewWitnessVerified=false\`; fornecer só o diretório não habilita downgrade silencioso. Quando há testemunho, fornecer a pasta é obrigatório; não é criada automaticamente. A saída de auditoria permanece **NO-GO** e seu código de saída é 2 mesmo com valores compatíveis e assinatura válida. O processo jamais ativa \`publicFaiscaEnabled\`.

## Limites e critérios de homologação

- Anti-replay é **somente por host e filesystem durável compartilhado**. Não há garantia contra restauração de snapshots, cópias do diretório, hosts independentes, operador com acesso de escrita privilegiado ou filesystem que descumpra a semântica de fsync. Ambiente multi-host requer serviço transacional independente homologado.
- A R177 não verifica que o revisor realmente consultou o provedor nem que o extrato corresponde a faturamento. Antes de qualquer GO público ainda são obrigatórias revisão independente AppSec/LGPD/FinOps/editorial, origem de dados confiável, homologação R95+ em staging privado e aprovação humana explícita.
- O diretório deve ser mantido sob backup e retenção com controle de acesso. **Não reutilizar nonces nem restaurar backups antigos como fonte vigente**.
- Teste: \`node --test tests/faisca-r175-independent-review-witness.test.mjs tests/faisca-r176-private-operator-witness-cli.test.mjs tests/faisca-r177-private-signed-review-replay.test.mjs\`; workflow CI completo com Node/Chromium/axe/HTTP e compatibilidade.
- Proibido merge, deploy, DNS, VPS, produção, CRM/Portal/Sites operacional, leads, tickets ou cobrança.

A homologação R92 e os testes pagos Luna/Terra executados manualmente anteriormente não foram repetidos. \`main\`, o mascote aprovado, o site público e \`publicFaiscaEnabled=false\` permanecem inalterados.
