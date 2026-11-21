# Faísca R199 — identidade do marcador durável entre Luna e Terra

## Risco concreto

A R198 mantém um marcador local de exclusão durante Luna, Terra e a entrega HTTP privada. No entanto, a instância registrava somente um booleano de propriedade. Se outro processo do mesmo usuário substituísse o arquivo por um marcador de **bytes idênticos**, uma instância antiga poderia reconhecer falsamente a propriedade durante o segundo despacho ou remover o marcador de outro processo. Isso poderia permitir gastos simultâneos após uma alteração acidental do diretório.

## Correção R199

- O ledger captura o par **dev/ino** do marcador criado via `O_CREAT|O_EXCL|O_NOFOLLOW`, após a escrita e `fsync` do arquivo, e só afirma propriedade depois do `fsync` do diretório.
- Antes de reutilizar a trava Luna → Terra ou liberá-la, reabre com `O_NOFOLLOW`, compara a identidade do descritor com a entrada observada, com a identidade original da instância e verifica tipo, proprietário, permissões, link count e bytes. Qualquer divergência resulta em **NO-START** e requer revisão humana.
- Não adiciona desbloqueio automático, TTL, retry de API ou tratamento otimista de marcadores antigos.
- O teste `node --test tests/faisca-r199-dispatch-marker-inode-revalidation.test.mjs` simula substituição por arquivo do mesmo conteúdo, troca por symlink, utilização saudável Luna/Terra e recusa do segundo transporte simulado ao adulterar a trava.

## Limites e gates

A verificação **não é uma defesa contra administrador ou processo hostil com o mesmo UID que controle o diretório**: ainda pode existir uma corrida entre a verificação e `unlink`. O marcador é apenas single-host e não coordena hosts diferentes. A confirmação HTTP `finish` não prova leitura pelo browser. As reservas são estimativas e não substituem auditoria independente do custo real. Homologação VPS acumulada e revisões AppSec/LGPD/FinOps/editorial continuam pendentes.

Somente fixtures sintéticas, sem chave real nem chamada paga. A homologação R92 e os testes Luna/Terra pagos realizados anteriormente pelo operador não foram repetidos.

**REVIEW-ONLY / NO-GO público:** não alterar `main`, mascote, site público, `publicFaiscaEnabled=false`, VPS/DNS; sem deploy, merge, Portal/CRM/Sites operacionais, leads, tickets ou cobranças. Exigir CI na HEAD exata e revisão técnica independente antes de qualquer staging operacional.
