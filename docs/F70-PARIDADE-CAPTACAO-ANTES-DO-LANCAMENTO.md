# F70 — Paridade do canal de orçamento antes da substituição do site

A inspeção pública do domínio atual da Imagine (10/11/2026) confirma um formulário de **solicitação de orçamento** em páginas do site legado. Já o novo site Astro, por decisão de privacidade e segurança, não possui formulário de captação operacional enquanto Portal/CRM e consentimento não estiverem homologados; oferece apenas canais de WhatsApp e e-mail.

Para evitar substituir o site atual e **perder o canal existente de conversão**, foi incluído um gate separado `legacy-contact-intake-parity` em `RELEASE_GATES`. Ele é obrigatório mesmo se todos os outros gates forem declarados revisados. `scripts/report-launch-blockers.mjs` passa a listá-lo automaticamente.

Critérios propostos para revisão humana:
1. Verificar se o formulário legado recebe e encaminha solicitações de fato (não basta existir visualmente) e se a eventual migração preserva a jornada e as expectativas de privacidade.
2. Validar formulário Portal/CRM em staging real com consentimento, separação multiempresa, antifraude, filas/reenvios, idempotência, MFA/grants e comunicação de falhas; **ou** aprovar explicitamente um fallback operacional com canais, responsáveis e consequências comerciais documentados.
3. Testar origem da campanha, acesso móvel/teclado, confirmação do envio, tratativa de erro, retenção de dados e passagem à equipe comercial.
4. Só então registrar evidências e autorização específica para release, separada da aprovação editorial/SEO/DNS.

O gate F42 é apenas um inventário documental, **não verifica automaticamente** funcionamento de CRM/WhatsApp/e-mail nem concede deploy mesmo que seja marcado 'reviewed'. O teste F70 comprova que o gate falta por padrão e não é suprido por CI verde.

Referência pública do formulário antigo: `https://www.imaginecomunicacao.com.br/fale-conosco.html`. Nenhum dado pessoal foi submetido ou lido nesse formulário; a análise é exclusivamente visual. Não foram ativados dados reais, novos endpoints, DNS, deploy ou custos.
