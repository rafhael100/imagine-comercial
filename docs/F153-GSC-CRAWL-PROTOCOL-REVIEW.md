# F153 — Paridade de protocolo GSC × crawl

Complementa a F152 no cruzamento de **duas fontes offline**. Antes, o comparador usava apenas host, caminho e flags de query/encoding: uma resposta HTTPS 200 podia indevidamente satisfazer uma URL HTTP registrada pelo Search Console.

## Implementação
- O leitor de crawl considera `observedHttp` na unicidade de URL e admite códigos HTTP diferentes para HTTP/HTTPS do mesmo host.
- Respostas HTTP não são classificadas como candidatas por força de um status 200 ou 301: permanecem `protocol_hold_for_manual_review`, mantendo o código original visível para auditoria.
- O cruzamento F27 só casa evidências com **protocolo + host + caminho + flags de variante** idênticos.
- O sumário fornece `observedHttp` e distingue registros de protocolo mesmo quando host e path são iguais. HTTP fica em investigação e não produz evidência de candidato.
- Sem informação explícita de protocolo, a comparação falha fechada. Parâmetros de URL e tokens continuam suprimidos.

**Limites:** relatórios de análise não são validação de origem GSC, não comprovam histórico completo, não produzem redirecionamentos nem liberam DNS, Cloudflare, publicação ou migração da `main`. Testes públicos usam somente URLs sintéticas; fontes reais e métricas privadas não entram no GitHub.
