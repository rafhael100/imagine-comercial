# R222 — Privacidade dos bytes persistidos pelo ledger do laboratório privado

## Risco coberto
A R220/R221 verifica que o navegador apaga pergunta e token e não usa storage. Isso não comprova que as **estruturas duráveis de reserva, testemunha e bloqueio** deixam de gravar inadvertidamente a transcrição, o bearer sintético ou o texto gerado. R222 adiciona uma inspeção explícita dos bytes realmente presentes no diretório privado, depois do fechamento da sessão HTTP, e após uma tentativa recusada no servidor reiniciado.

## Prova executável
A etapa `node ops/faisca/openai/private-token-details-browser-qa.mjs` continua exercitando Chromium real/axe WCAG A/AA, HTTP loopback e Luna/Terra simuladas. Para sucesso, erro de Luna e erro de Terra, o novo gate:

- percorre todos os arquivos presentes no ledger privado (não a UI), exige tipo regular sem link físico adicional, permissão exclusiva do dono e até 1024 bytes por arquivo;
- recusa bytes da pergunta e resposta fictícias, token, chave de teste e marcadores de campos de entrada/saída da IA;
- recusa URLs, padrão de chave de API, bearer e endereço eletrônico nos bytes duráveis;
- comprova novamente a ausência desses dados após tentativa HTTP bloqueada por NO-START persistido e reinício, sem conceder novo despacho.

O teste **falha fechado** se novos arquivos não forem privados ou alterarem o contrato de persistência. Asserções de ausência de strings sintéticas não equivalem a análise abrangente de dados pessoais, criptografia, relatório de privacidade ou teste da infraestrutura real.

## Operação e limites
Somente código de laboratório e documentação, branch isolada/PR draft sobre R221. Sem dados reais, chamadas pagas, acesso à VPS, merge, deploy, alteração de `main`, DNS, CRM/Portal/Sites operacionais, cobrança, lead ou ticket. O Faísca e o site público permanecem inalterados, `publicFaiscaEnabled=false`. A homologação R92 e testes pagos relatados não foram repetidos. Seguimos sem evidência de R95 instalada na VPS, revisão AppSec/LGPD/FinOps/editorial ou conciliação externa do faturamento.

**NO-GO público.**
