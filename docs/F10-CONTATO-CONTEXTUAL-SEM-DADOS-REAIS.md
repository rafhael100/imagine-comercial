# F10 — Conversão por serviço com contexto seguro

## Objetivo
Reduzir a fricção comercial entre a página do serviço e o atendimento, preservando uma página estática, acessível e indexável.

## Comportamento
- CTAs das seis páginas de serviço apontam para `/contato/#slug-aprovado`. O fragmento não altera a canonical nem é enviado ao servidor HTTP.
- A página de contato possui um seletor acessível com as seis ofertas publicadas no catálogo editorial.
- Um script mínimo de cliente verifica que o fragmento pertence **à lista de opções autorizadas** e pré-seleciona o serviço.
- O WhatsApp e o assunto do e-mail são preparados apenas quando o visitante escolhe ou chega via CTA; não há requisição AJAX, coleta de dados, API ou token.
- Links WhatsApp/e-mail/telefone existentes permanecem utilizáveis se o JavaScript estiver desabilitado.
- A jornada recebe teste Playwright em desktop e mobile, além dos testes SEO e WCAG já existentes.

## Restrições
- Não enviar dados de clientes por link/URL, não registrar visitantes na biblioteca nem enviar leads ao CRM.
- O site não registra nem armazena dados de quem clicou no atendimento, e não alega medir conversões reais.
- Reconfirmar número WhatsApp e e-mail de atendimento antes da produção.
- Um formulário integrado ao Portal requer interface e contrato de privacidade/consentimento próprios e autenticação/segurança antes de ativar.

PR draft; sem merge e sem alteração no domínio existente.
