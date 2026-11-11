# F72 — Transparência dos canais externos no Contato

Antes dos links WhatsApp/e-mail, a página `/contato/` informa expressamente que ambos são **canais externos**, que o texto do WhatsApp aparece no serviço de destino após o clique e que o visitante ainda precisa conferir e confirmar o envio. O cliente de e-mail é aberto pelo dispositivo. Nenhuma solicitação é recebida pela Imagine simplesmente porque o visitante alterou um seletor.

Os dois links utilizam `aria-describedby="external-channel-notice"`, permitindo que tecnologias assistivas relacionem a explicação ao canal. WhatsApp mantém `target="_blank"` e `rel="noopener noreferrer"`. O texto é estático, sem scripts ou novos acessos de rede; a explicação permanece disponível sem JavaScript.

Esta transparência **não** equivale a política jurídica aprovada, formulário funcional, consentimento persistido ou integração ao CRM. O gate F70 de paridade do orçamento legado permanece bloqueado até aprovação expressa de fluxo efetivo. Revisar conteúdo com jurídico/editorial antes da publicação. Sem deploy, DNS, conta de cliente, main ou novas despesas.
