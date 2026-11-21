# Faísca R186 — hardlinks recusados nos arquivos duráveis de gasto

## Escopo

Correção restrita ao **laboratório privado** de Luna/Terra. O ledger de reservas e
os seus dois marcadores duráveis e testemunha high-water agora exigem
`stat.nlink === 1`, além da política já existente de propriedade, modo 0600,
O_NOFOLLOW, sincronização e bloqueio O_EXCL.

Antes da R186, um arquivo regular com modo 0600 e outro nome (hardlink) fora
do diretório 0700 poderia continuar passando a verificação de formato. Uma
alteração por esse segundo nome não precisa passar pelo lock do ledger.
A R186 recusa a inicialização/readiness e qualquer nova reserva nesse caso,
sem tentar remover o link, recriar o estado ou devolver créditos.

## Prova de laboratório

`node --test tests/faisca-r186-private-ledger-hardlinks.test.mjs` verifica
separadamente os quatro arquivos persistentes, cria um nome adicional fora
do diretório privativo, exige falha fechada antes de Luna, sem chamadas a
`fetchImpl`, e mantém o valor previamente reservado. O teste positivo
confirma reservas sequenciais por duas instâncias sem hardlinks.

Os testes são **sintéticos e locais**. Não consultam a OpenAI, não usam
credenciais reais, não coletam mensagens de clientes e não comprovam
faturamento, staging da VPS ou implantação.

## Gates

- CI Node, HTTP, Chromium/axe, integração Portal/Onepage, PHP, PostgreSQL
  descartável e Comercial/SEO/build na HEAD exata desta PR draft.
- Revisão independente de segurança/privacidade, orçamento e conteúdo.
- Na VPS, a eventual homologação de revisões posteriores à R92 requer
  decisão operacional separada, pin SHA independente, ambiente privado
  autorizado e teste com dados fictícios. R95+ não está comprovadamente
  instalado.
- **Não alterar** main, mascote, site público ou
  `publicFaiscaEnabled=false`; sem merge, deploy, DNS, CRM/Portal/Sites
  operacionais, lead, ticket, cobrança ou GO público.

Esta barreira protege contra aliases locais acidentais/não autorizados.
Não impede ataques de um agente com controle integral do host, do volume,
da chave ou do faturamento do provedor.
