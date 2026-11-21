# Faísca R189 — composição seletiva R186 + R188 no ledger privado

## Dependência e motivação
R186 #664 e R187 #665 foram desenvolvidas em branches irmãs sobre R185.
R188 #666 (em cima de R187) fecha a lacuna de erro após persistir uma
reserva durável, mas **não** contém automaticamente as alterações de R186.
Esta branch nasce da HEAD exata de R188 e reproduz seletivamente a
verificação de `nlink === 1` dos quatro arquivos persistentes de R186,
sem tocar na branch original e sem merge de PR ou produção.

## Contratos compostos
- Arquivos `faisca-reservations.json`, os dois marcadores e a testemunha
  high-water devem ter um único link para impedir alias mutável.
- Uma falha na leitura/reserva por hardlink retém a trava persistente do
  ledger, e a instância do adaptador não tenta novamente após o erro
  de reserva; não envia pergunta à IA.
- O erro do adaptador é genérico, sem detalhes internos do armazenamento.
  O teste R186 da branch original esperava erro detalhado, mas **na
  composição R188** o contrato correto é sanitizado.
- Um ledger saudável ainda comporta reservas sequenciais com respostas
  Luna fictícias, sem repetir chamadas inesperadas.

## Execução
`node --test tests/faisca-r189-compose-hardlink-lostack.test.mjs`

Cinco cenários (quatro arquivos adversariais e um positivo) em diretório
temporário. Não são usadas chaves, API paga, clientes, VPS, dados reais ou
conexões operacionais.

## Gates / pendências
CI na HEAD exata, validação Node/HTTP/Chromium/axe/WCAG,
Onepage/Portal, PHP/PG descartável, Comercial/SEO/build.
AppSec, LGPD, FinOps e editorial ainda precisam de revisão independente;
homologação acumulada R95+ em staging privado ainda não está comprovada.
A homologação R92 e os testes Luna/Terra reais prévios relatados pelo
operador não foram repetidos. O ledger não certifica valores cobrados pela
OpenAI, nem protege contra controle integral do host.
R189 é somente laboratório e review: nenhum merge, deploy, DNS/VPS,
atendimento público, CRM/Portal/Sites operacionais, leads ou cobranças.
Preservar `main`, site público, mascote e `publicFaiscaEnabled=false`.
