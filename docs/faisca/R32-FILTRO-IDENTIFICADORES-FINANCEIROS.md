# Faísca R32 — recusa preventiva de identificadores financeiros e documentos

**Base:** Faísca R31 [#495](https://github.com/rafhael100/imagine-comercial/pull/495). **Escopo:** filtragem local, sem provedor externo.

## Defeito preventivo

O núcleo Faísca já mascara e-mail, telefone, CPF/CNPJ longo e palavras de credenciais (senha, token, MFA). Alguns identificadores igualmente privados podem não conter dez dígitos seguidos e escapar do detector conservador:

- chave Pix aleatória em UUID ou valor não numérico;
- RG curto ou formatado e CEP residencial;
- URLs com parâmetros de autenticação (`access_token`, `session`, `api_key`, `auth`);
- credencial com marcador `Bearer` sem menção à palavra `token`.

Esse texto não deve ser exibido na conversa, entrar na qualificação nem chegar ao futuro modelo de IA ou PHP. A R32 reforça o **preflight comum** em `ops/faisca/core.mjs`, antes de qualquer roteador ou interpretação do conteúdo.

## Alteração implementada

A detecção continua conservadora e em PT-BR, buscando combinações de alta confiança: `chave Pix`, `Pix copia e cola`, `meu/minha RG/CEP/CPF/CNPJ`, RG e CEP com formato explícito, URL de autenticação com query string e palavra Bearer. O detector não grava os valores e retorna somente o mesmo marcador fixo já aprovado:

`[Mensagem com possível dado pessoal ou credencial ocultada]`.

O texto original não é usado como resposta, opção de qualificação, justificativa de modelo ou fonte. A alteração **não substitui uma solução DLP/PII completa** nem valida juridicamente consentimento e tratamento de dados; novos casos dependerão de avaliação especializada e testes de produção.

## Testes

`tests/faisca-r32-sensitive-boundary.test.mjs` cobre 11 entradas sintéticas e verifica:
1. mascara no núcleo sem eco nem fonte;
2. recusa no runtime R09 antes de chamar provedor;
3. recusa no mapeador de campos fechados R08;
4. preservação da solução e estado de qualificação durante mensagem privada;
5. perguntas comerciais legítimas, incluindo **Vocês aceitam Pix?**, permanecem possíveis, sem recusa indevida por palavra genérica.

A CI deve passar **na SHA exata da R32**, incluindo testes de privacidade R15/R16, quotas R31, PHP pinado, navegador, SEO, PostgreSQL descartável e bloqueio do build público R26.

## O que permanece desativado

A R32 não envia dados a terceiros, não cria conexão com OpenAI ou outro provedor, não liga CRM, Portal, PSP, checkout, webhook, serviços de custo nem coleta telefone/e-mail. O mascote e as páginas Astro públicas ficam intocados.

A ativação de IA real exigirá revisão independente da eficiência de filtragem, testes adversariais, aviso de privacidade, base legal e retenção adequadas, segredos em vault, cotas financeiras duráveis e aprovação de release. A ausência de match regex **não é garantia de ausência de dados pessoais**.
