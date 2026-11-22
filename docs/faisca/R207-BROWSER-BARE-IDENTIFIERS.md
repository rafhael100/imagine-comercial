# Faísca R207 — formato de identificadores na saída do navegador privado

**Base imutável:** R206 #684 HEAD `c1c9d24b54194830bd4ee9bb0d6136d14617b642`, 6/6 workflows de CI concluídos com sucesso. O histórico R72–R95 mantém PRs draft.

## Lacuna corrigida

A verificação HTTP e o adaptador privado já recusam domínios, endereços IP, contatos numéricos e alguns formatos de segredo, mas o navegador R206 validava apenas palavras como CPF, token e email, o caractere `@` e letras não latinas. Um HTTP 200 local forjado com proveniência Luna/Terra sintaticamente correta poderia exibir um domínio puro ou número de telefone fictício. O navegador é um limite de defesa independente, não substitui os controles autoritativos.

## Alteração

- Verificador `privateBrowserPiiRisk` recusa hostnames ASCII/IDN, URLs, IP abreviado, sequências longas de dígitos e formas conhecidas de chave de API/GitHub, com normalização Unicode apenas para detecção; continua sem armazenar, registrar ou transmitir o conteúdo.
- QA Chromium injeta seis respostas HTTP 200 sintéticas, mantendo os campos de modelo/status verossímeis, e comprova cinco rejeições, uma aceitação de texto seguro, limpeza do token/pergunta/atestado, ausência de citação e nenhuma chamada ao provedor.
- Teste Node HTTP real apenas em 127.0.0.1 confirma que o lado servidor continua devolvendo 503 genérico, sem ecoar identificadores, e aceita orientação fictícia segura.
- Os assets e o mascote permanecem os originais; revisão de integridade R94, CSP, tamanho de resposta, WCAG e demais suites devem passar na HEAD desta entrega.

## Gates e proibições

- [ ] Confirmar CI GitHub Actions na HEAD R207 (Node/HTTP/Chromium/axe/Onepage/PHP/PG/Comercial/SEO).
- [ ] Revisão humana independente AppSec/LGPD/FinOps/editorial e reconciliação do consumo real.
- [ ] Homologação privada acumulada na VPS/staging com evidência direta, sem presumir que a R95–R207 esteja instalada.

O filtro lexical **não garante detecção completa de dados pessoais, segurança factual ou veracidade de toda resposta**. Apenas fixtures; nenhum teste pago nesta entrega e nenhuma chave obtida.

**NO-GO público:** preservar `publicFaiscaEnabled=false`, `main`, site público e mascote aprovado. Sem merge, deploy, DNS, VPS, Portal/Sites/CRM operacional, dados reais, leads, cobranças ou tickets.
