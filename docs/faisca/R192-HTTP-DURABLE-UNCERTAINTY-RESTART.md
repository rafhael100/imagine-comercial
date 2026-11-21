# Faísca R192 — HTTP privado: reinicialização após resultado incerto

## Contrato de staging, sem produção
Integra as barreiras R187, R188, R190 e o marcador durável R191 no servidor de revisão HTTP real, vinculado somente a 127.0.0.1. O teste inicia o servidor privado, recebe um erro 503 **sintético** da API após uma reserva real no ledger descartável, fecha o servidor e inicia outro com um novo adaptador e ledger sobre o mesmo diretório.

A nova sessão recebe somente 503 genérico com `Cache-Control: no-store`, sem CORS, sem novo despacho Luna/Terra, sem retry ou reset da reserva persistida. O marcador de resultado incerto impede também `ready()` até reconciliação explícita.

**Executar:** `node --test tests/faisca-r192-private-http-provider-restart.test.mjs`. A suíte global `npm test` e os workflows Node/HTTP/Chromium/axe, Portal/Onepage, PHP/PG descartável e Comercial/SEO/build devem passar na HEAD exata.

## Limites e gates
- Um servidor de loopback descartável com resposta simulada não comprova implantação na VPS ou homologação acumulada no staging real. Não acessar a VPS nem repetir a homologação R92/testes pagos anteriores.
- Corridas entre múltiplos workers e chamadas já em voo não são resolvidas pelo marcador pós-falha. Falha de fsync requer intervenção do operador. A verificação do faturamento deve ser independente.
- AppSec, LGPD, FinOps, revisão editorial e isolamento operacional continuam gates obrigatórios; teste de navegador/mascote existente na CI deve permanecer verde.
- Sem credenciais reais, PII, cliente real, CRM/Portal/Sites operacional, leads, tickets ou cobranças.
- **NO-GO público:** PR draft isolada; não alterar `main`, site, mascote, `publicFaiscaEnabled=false`, DNS/VPS, deploy ou produção.
