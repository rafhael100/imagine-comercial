# R118 — Paridade de privacidade Unicode da interface privada

O preflight no JavaScript da tela privada agora detecta contatos com numerais Unicode (incluindo separadores árabes, pontuação compatível e sinais de mais) e formas escritas com “arroba … ponto” antes do POST para o servidor loopback. O servidor mantém uma validação independente. Testes apenas com conteúdo fictício.

**Revisão:** executar Node/HTTP/Chromium/axe e CI na SHA exata. Ainda faltam AppSec e homologação privada da candidata R95+. Homologação anterior R92 permanece reconhecida, sem inferir deploy. Sem alterar main, mascote, site público, DNS/VPS, CRM ou Portal. `publicFaiscaEnabled=false` e sem GO público.