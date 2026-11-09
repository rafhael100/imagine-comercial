/**
 * Exemplos confirmados por busca pública em 09/11/2026.
 * NÃO equivale ao inventário integral (faltam GSC, sitemap, backlinks e crawl completo).
 * NÃO habilitar redirecionamentos antes da auditoria e liberação de produção.
 */
export const legacyUrls = Object.freeze([
  {
    from: '/fale-conosco.html', to: '/contato/', status: 'candidate',
    reason: 'Página de contato legada; equivalência final exige revisão editorial.'
  },
  {
    from: '/agencia-imagine-comunicacao-digital.html', to: '/sobre/', status: 'candidate',
    reason: 'Página institucional legada; revisar eventuais dados históricos e alegações antes da migração.'
  },
  {
    from: '/o-que-fazemos/criacao-de-sites-institucional.html',
    to: '/servicos/criacao-de-sites/', status: 'candidate',
    reason: 'Página institucional antiga ligada no menu; avaliar equivalência do novo serviço sem copiar alegações históricas.'
  },
  {
    from: '/o-que-fazemos/google-ads-anuncios.html',
    to: '/servicos/gestao-google-ads/', status: 'candidate',
    reason: 'Página Google Ads antiga ligada no menu; mesma intenção principal, mas conteúdo e escopo exigem revisão.'
  },
  {
    from: '/o-que-fazemos/facebook-instagram-ads.html',
    to: '/servicos/gestao-meta-ads/', status: 'candidate',
    reason: 'Página Meta encontrada no menu e conteúdo público consultado em 09/11/2026; ainda exige validação HTTP atual, equivalência editorial e autorização para 301.'
  },
  {
    from: '/o-que-fazemos/criacao-de-loja-virtual.html',
    to: null, status: 'hold',
    reason: 'Loja virtual não possui página de serviço equivalente homologada no catálogo Astro atual; evitar redirecionar para site institucional.'
  },
  {
    from: '/o-que-fazemos/youtube-ads-anuncios.html',
    to: null, status: 'hold',
    reason: 'Serviço antigo específico de YouTube Ads sem página correspondente homologada; revisar escopo antes de redirecionar.'
  },
  {
    from: '/o-que-fazemos/linkedin-ads-anuncios.html',
    to: null, status: 'hold',
    reason: 'Serviço antigo LinkedIn Ads não está no catálogo novo; não confundir com gestão Meta ou Google Ads.'
  },
  {
    from: '/o-que-fazemos/marketplace-amazon.html',
    to: null, status: 'hold',
    reason: 'Marketplace Amazon é categoria diferente dos produtos novos; exige decisão sobre continuidade comercial.'
  },
  {
    from: '/o-que-fazemos/marketplace-mercado-livre.html',
    to: null, status: 'hold',
    reason: 'Página Marketplace Mercado Livre e conteúdo visíveis em consulta pública de 09/11/2026; status HTTP atual ainda não comprovado e não há serviço equivalente homologado.'
  },
  {
    from: '/clientes.html', to: null, status: 'hold',
    reason: 'Aguardando portfólio com autorizações de divulgação; não redirecionar para a homepage.'
  },
  {
    from: '/en-us/', to: null, status: 'hold',
    reason: 'Necessária decisão de conteúdo em inglês e hreflang.'
  },
  {
    from: '/en-us/customers.html', to: null, status: 'hold',
    reason: 'Necessária versão em inglês e política de portfólio.'
  },
  {
    from: '/en-us/termos-de-uso.html', to: null, status: 'hold',
    reason: 'Página legada de termos/privacidade em inglês. Preservação e política de dados exigem validação jurídica e versão equivalente.'
  },
  {
    from: '/en-us/contact-us.html', to: null, status: 'hold',
    reason: 'Necessária preservação adequada do conteúdo em inglês.'
  }
]);
