# Faísca R09-E — gate de ativação de IA generativa

**Status:** preparação documental. Nenhum provedor, modelo, chave ou endpoint foi escolhido ou conectado.  
**Dependência:** R09-A/B/C/D e revisão independente.

## Estado atual

O roteador R09 já tem:
- recuperação determinística de até cinco respostas R06 aprovadas;
- contrato fechado para selecionar um `answerId`, pedir clarificação fixa ou declarar ausência de suporte;
- contrato fechado para mapear texto livre a valores enumerados da qualificação;
- runtime simulado com idempotência, bloqueio de concorrência, timeout e conciliação;
- pipeline R09 → R06 com validação do conteúdo pelo PHP real;
- fallback fixo sem fontes quando não há evidência;
- nenhuma chamada a modelo externo. `externalModelInvocations=0`.

## Decisões que precisam de aprovação humana

### 1. Provedor e modelo
- fornecedor e modelo exatos;
- API hospedada ou modelo self-hosted;
- região de processamento e suboperadores;
- disponibilidade, limites de taxa e SLA;
- compatibilidade com saída estruturada estrita.

Nenhum fornecedor é presumido. A escolha depende de custo, privacidade, latência e qualidade em português.

### 2. Orçamento e limites
- teto de gasto mensal e diário;
- limite por conversa, empresa e visitante;
- máximo de tokens de entrada/saída;
- concorrência e limite de requisições;
- comportamento ao atingir o teto: fallback local, nunca cobrança ilimitada;
- alerta e desligamento automático ao atingir o orçamento.

A integração não poderá começar sem limites definidos e um mecanismo server-side que os aplique antes de cada despacho.

### 3. Privacidade e dados
- aviso claro ao visitante de que a mensagem poderá ser processada por um provedor externo;
- finalidade, base legal, retenção e região;
- política de não enviar credenciais, dados sensíveis ou dados de contato desnecessários;
- minimização/redação antes do despacho;
- logs sem conteúdo pessoal e sem segredos;
- retenção e exclusão documentadas;
- contrato/DPA e avaliação de transferência internacional quando aplicável.

A mensagem do visitante não será enviada a terceiros até a aprovação dessas condições.

### 4. Segurança e autoridade
- chave apenas no servidor, em segredo gerenciado, nunca no browser ou repositório;
- rotação e revogação testadas;
- chamadas sem ferramentas, browsing, execução de código ou acesso ao CRM;
- o modelo não pode gerar preço, prazo, garantia, contrato ou condição comercial;
- o modelo não pode selecionar tenant, usuário, serviço contratado ou permissões;
- a saída continua restrita a IDs do catálogo R06 ou valores enumerados R08;
- PHP continua validando o texto e as fontes antes de exibir resposta factual.

### 5. Operação
- timeout, resultado incerto e conciliação pelo mesmo ID;
- idempotência e bloqueio de duplicidade;
- fallback fixo quando provedor falhar, exceder custo ou retornar schema inválido;
- rate limiting e circuit breaker;
- métricas agregadas sem transcrição pessoal;
- escalonamento humano sem afirmar que uma mensagem foi enviada quando não foi.

## Critérios de ativação

A IA real só poderá ser ligada quando todos forem verdadeiros:
1. provedor/modelo aprovados;
2. orçamento e limites aprovados;
3. aviso de privacidade e tratamento de dados aprovados;
4. segredos configurados no servidor e nunca no browser;
5. revisão independente R09 aprovada;
6. testes de prompt injection, PII, cross-tenant, timeout, replay e orçamento aprovados;
7. CI verde com PHP real, browser e fallback;
8. flag de ativação desligada por padrão e habilitada somente após autorização explícita.

## Não fazer

- Não criar chave de API ou conta de fornecedor.
- Não habilitar chamada externa.
- Não enviar mensagens de visitantes a terceiros.
- Não habilitar tools/function calling.
- Não conectar CRM, Portal, e-mail, mensageria ou pagamentos.
- Não alterar o mascote, o site público ou DNS.
- Não assumir custo ou contratação sem aprovação.

**Conclusão:** a arquitetura está preparada para receber um adaptador futuro, mas a IA generativa real permanece desligada. A próxima ação externa depende de decisões explícitas do responsável pelo projeto.
