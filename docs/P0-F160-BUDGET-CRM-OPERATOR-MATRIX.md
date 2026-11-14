# P0 F160 — Demonstrador do roteiro de orçamento para CRM

CLI local `node scripts/review-private-budget-to-crm.mjs` compõe cinco cenários **100% fictícios** por meio do mesmo código F157/F159, devolvendo JSON de diagnósticos sanitizados (compatibilidade de formato, contato inválido, CAS obsoleto, resultado incerto, destino divergente).

Nenhum cenário pode enviar ou registrar contato, inferir consentimento, liberar repetição, emitir ACK ou publicar em produção. O fluxo permanece sem parâmetros de CLI, stdin ou rede. Os testes Node executam o comando e asseguram que dados de exemplo e UUIDs não saem na resposta. A interface web pública continua sem formulário. Execução no GitHub Actions pelo `npm test`, sem novo fornecedor ou instalação.
