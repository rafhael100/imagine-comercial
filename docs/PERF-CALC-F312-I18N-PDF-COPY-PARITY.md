# Imagine Comercial — paridade de PDF/cópia PT, EN, ES

A calculadora já constrói cenários anonimamente em PT, EN e ES. Esta
entrega corrige a diferença de experiência: EN/ES agora têm os mesmos
controles para **imprimir/salvar como PDF** e **copiar o resumo local**
que a versão portuguesa.

## Regras

- Nada é enviado automaticamente: não há formulário, sessão persistente,
  requisição de API, envio de e-mail ou inscrição em CRM.
- O navegador só executa `window.print()` **após clique explícito** do
  visitante e cálculo válido; o sistema operacional/browser oferece a opção
  de salvar como PDF, sem gerar arquivos no servidor.
- A cópia para clipboard só ocorre **após clique explícito** e se a API
  segura do navegador existir. Falha é informada de maneira acessível.
- Cópia inclui **mídia sugerida, 20% de gestão apenas referencial,
  ativação única R$490/canal e subtotal do primeiro ciclo**.
- O resumo afirma que **mínimo de gestão mensal continua pendente**,
  portanto nenhum número representa cotação definitiva.
- Erro de recálculo apaga o resumo em memória e esconde
  `Copiar`/`Imprimir`, impedindo compartilhamento acidental do cenário
  anterior. Nenhum dado pessoal é solicitado.
- No modo impressão, botões e formulário são ocultados e resultados
  preservados no papel/A4.

## Testes

Chromium local autenticado, sem serviços externos: cálculo em três idiomas,
R$490 de ativação e R$1690 no cenário Meta, R$1470 de ativação e R$6630
no cenário de três canais, botão Imprimir acionando API só por clique,
clipboard sintético local, recálculo inválido escondendo resultados,
zero POST, zero endpoints externos, zero inputs de identificação.

**DRAFT / NO-MERGE / NO-DEPLOY / NO-CRM-WRITE / NO-CHARGE.**
