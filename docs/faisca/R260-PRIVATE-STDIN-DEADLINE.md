# R260 — prazo absoluto da entrada privada, revisão local (DRAFT)

A R259 já limita stdin a 512 KiB, mas um operador ou pipe defeituoso
poderia manter a entrada aberta indefinidamente sem ultrapassar esse
limite. A R260 fixa prazo total de 3 segundos **antes de realizar qualquer
inspeção HTTP**, destrói somente o stream local de entrada quando expira,
bloqueia a revisão com HOLD e não imprime o payload ou caminhos.

O prazo é absoluto desde o início da leitura: uma sequência de pequenos
fragmentos não pode reiniciar o relógio. A etapa R259 permanece a mesma:
27 sondas anônimas fixas em 127.0.0.1:4337 e :4336, somente após um
JSON de inspeção Docker relatado e pin de imagem independente. Não
acessa VPS/SSH/Docker, não envia POST, não tem credenciais e não chama IA.

Testes Node executáveis cobrem stdin parcial e gotejamento por pipe
com stream mantido aberto, além de bloqueio precoce sob CI. Todo o
output de falha é constante; não registra fixture ou contexto privado.

A aprovação desta entrega não confirma implantação R95, propriedade dos
processos, conversa autenticada ou gastos efetivos. É somente
resiliência do CLI de homologação offline; AppSec, privacidade,
FinOps, revisão editorial e autorização operacional seguem HOLD.

Sem merge/deploy/DNS/VPS, sem clientes reais, sem cobrança, lead ou
ticket, sem acionar CRM/Portal/Sites. O site, mascote, main e
publicFaiscaEnabled=false permanecem intocados.
