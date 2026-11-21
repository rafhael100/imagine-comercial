# Faísca R200 — HTTP privado integrado à identidade do marcador

## Incremento de homologação sintética

A R199 impede que o adaptador Luna/Terra reutilize um marcador durável substituído por outro inode, mesmo com bytes idênticos. A R200 acrescenta um teste **HTTP de loopback real**, que percorre o caminho R95/R198/R199 e o bloqueio de reinício de R191.

Em dois cenários de fixtures, a primeira resposta fictícia Luna é concluída após uma substituição local do marcador: (1) arquivo novo com o mesmo conteúdo e (2) symlink para o arquivo original. A tentativa seguinte de Terra é bloqueada **antes do transporte**. O HTTP retorna 503 genérico sem pergunta, credencial, arquivo, inode ou nomes de modelo; o ledger conserva as reservas e o marcador durável de incerteza. Após reiniciar o servidor privado, uma nova conversa também recebe 503 e zero chamadas de provedor.

Executar `node --test tests/faisca-r200-http-marker-inode-staging.test.mjs`. O fluxo usa HTTP real **somente em 127.0.0.1** e transportes OpenAI simulados. O teste faz parte de `npm test` e dos workflows CI existentes para Node, HTTP, Chromium/axe, Portal/Onepage, PHP, PostgreSQL e Comercial/SEO.

## Restrições

Isto não é uma prova de instalação na VPS e não reutiliza a chave ou os testes pagos do operador. A proteção depende de filesystem local e da segurança do diretório 0700. Um administrador ou processo hostil do mesmo UID, com acesso irrestrito, exige isolamento de sistema operacional; o tempo entre a checagem do inode e `unlink` ainda permite TOCTOU. O evento `finish` HTTP não é ACK confirmado pelo navegador. O ledger registra reservas estimadas e não reconcilia o faturamento real.

**Sem GO público:** manter `main`, mascote, site público e `publicFaiscaEnabled=false` intactos. Sem merge, deploy, VPS/DNS, Portal/CRM/Sites operacionais, dados de clientes, tickets, leads ou cobranças. Pendente revisão independente AppSec/LGPD/FinOps/editorial e homologação privada acumulada antes de qualquer decisão operacional.
