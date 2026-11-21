# Faísca R168 — erros sanitizados e verificação dupla dos agregados privados

A R167 já impedia a execução do CLI em CI e não imprimia entradas inválidas. A R168 fecha uma outra via: **consumidores que importam diretamente o módulo de auditoria offline** não recebem mais exceções nativas do parser JSON ou do sistema de arquivos com trechos do conteúdo ou caminhos locais. Falhas de parse, formato, permissão, desaparecimento de arquivo e configuração têm uma mensagem única, constante, sem caminhos, valores, texto, credenciais ou stack de fonte.

A leitura dos três arquivos fixos 0600 agora é repetida e comparada antes da decisão, com nova inspeção do diretório 0700. Isso detecta modificações entre observações em muitos casos, mas **não torna a captura atômica**, não impede adversários com controle do host, não autentica o agregado do provedor e não comprova faturamento real. Em discrepância, o procedimento permanece fail-closed, sem repetir chamadas nem reembolsar reservas.

Regressão sintética: `node --test tests/faisca-r168-private-offline-error-safety.test.mjs` e `npm test`. Usa apenas arquivos descartáveis e dados fictícios, sem OpenAI real, VPS, Portal/Sites, CRM, chaves, pessoas ou despesas.

**Gates mantidos:** revisão independente AppSec/LGPD/FinOps/editorial, evidência real de origem fora do GitHub, homologação R95+ por operador, validação do staging privado. Sem GO público, merge, deploy, DNS, mudança em `main`, alteração do mascote ou `publicFaiscaEnabled=false`. R92 e os testes pagos prévios não foram refeitos.
