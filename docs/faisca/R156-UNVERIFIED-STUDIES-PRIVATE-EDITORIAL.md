# Faísca R156 — estudos, relatórios e endossos externos sem comprovação

## Risco identificado

A barreira R147 recusa atribuições explícitas como “Segundo o Google”, mas ainda permitia outras maneiras de o modelo inventar autoridade: “Estudo do Google”, “Relatório da Meta”, “Levantamento do IBGE” e “O Sebrae afirmou”. O Faísca privado não consulta nem valida uma fonte externa verificável para essas alegações, e o HTTP 200 de um adaptador não transforma o texto em prova.

## Mudança executável

Ampliação conservadora e independente de duas defesas: `hasPrivateUnsupportedOutcomeGuarantee` no host (aplicado ao cliente Luna/Terra e às duas rotas HTTP), e `privateBrowserUnsupportedAuthority` no JavaScript real da revisão privada. Sem alterar a atribuição editorial R06, prompts, modelos, preços, identidade do mascote ou a interface pública. Os testes R147 agora incluem quatro novos exemplos sintéticos em camadas: função, adaptador simulado sem retry, HTTP loopback e navegador real via VM; a suíte existente de Chromium/axe continua em CI.

Não se afirma que a defesa lexical detecte todas as alucinações. Afirmações factuais com fontes exigem futura política de grounding, revisão editorial e evidência humana. A restrição conservadora pode recusar frases verdadeiras sem fonte, o que é intencional no laboratório.

## Gates

- [ ] CI seis workflows na HEAD exata R156, incluindo Node/HTTP/Chromium/axe.
- [ ] Revisão editorial/AppSec/LGPD independente.
- [ ] Homologação acumulada R95–R156 por operador no staging privado e reconciliação de API/ledger.

A R92 e os testes pagos anteriores continuam respeitados. Não houve alterações na VPS, DNS, CRM, Portal/Sites operacional, leads, tickets, contratos, cobranças, `main`, site público, mascote aprovado ou `publicFaiscaEnabled=false`. Sem GO de atendimento público nem consumo pago em CI.
