# F175 — Compartilhar a comparação de dois serviços

## Funcionalidade

A F174 permite selecionar até duas soluções do catálogo para compará-las lado a lado. A F175 torna essa comparação recuperável por **um link explícito**, sem criar conta, preencher formulário ou salvar dados do visitante.

Ao selecionar duas soluções, o botão **Copiar link desta comparação** fica visível quando o navegador oferece Clipboard API. O link é construído somente com o domínio do site, o caminho fixo `/comparar-solucoes/` e dois slugs públicos permitidos, por exemplo `#comparar:onepage:landing-pages`. A query string da página atual não é copiada.

Ao abrir ou recarregar esse link, a interface restaura as duas opções. O codificador normaliza a ordem conforme o catálogo e admite **exatamente 15 pares** distintos de seis soluções; fragmentos arbitrários, malformados ou com dados pessoais são rejeitados. Não altera histórico com uma entrada nova para cada clique: o estado usa `replaceState`. A confirmação da cópia ignora a conclusão tardia quando as escolhas mudam, preservando a segurança de uso assíncrono.

Com JavaScript desligado, os seis cartões, critérios e links originais continuam disponíveis; seleção/cópia ficam ocultas. O link não constitui preço, diagnóstico de adequação ou proposta contratual.

Testes Node percorrem os 15 pares e versões malformadas. Chromium valida cópia literal, persistência **somente no fragmento da URL**, restauração em reload, rejeição de injeção, limite de duas opções e fallback sem JavaScript. Não há cookies, storage, CRM, identificação de usuário, envio de lead nem deploy nesta entrega.
