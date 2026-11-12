/**
 * Inventário preliminar de caminhos legados; URLs públicas observadas e revisão
 * de cobertura de busca. Sem métricas de GSC, dados pessoais ou parâmetros.
 * Não é completo: faltam crawl, backlinks e equivalência editorial.
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
  },
  {
    from: '/trabalhe-conosco.html', to: null, status: 'hold',
    reason: 'Recrutamento sem página equivalente homologada; revisar conteúdo e privacidade.'
  },
  {
    from: '/component/imaginecontato/criacao-de-sites-em-fortaleza.html', to: null, status: 'hold',
    reason: 'Rota antiga de contato/captação; verificar privacidade e equivalência.'
  },
  {
    from: '/en-us/services/criacao-de-sites-institucional.html',
    to: null, status: 'hold',
    reason: 'Página pública legada Website Creation em inglês; exige decisão sobre tradução, hreflang e correspondência editorial antes de qualquer 301.'
  },
  {
    from: '/en-us/services/youtube-ads-anuncios.html',
    to: null, status: 'hold',
    reason: 'Página pública legada YouTube Ads em inglês sem serviço equivalente publicado e aprovado; manter HOLD até decisão de escopo e idioma.'
  },
  {
    from: '/en-us/services/criacao-de-loja-virtual.html', to: null, status: 'hold',
    reason: 'Loja virtual em inglês sem serviço equivalente nem política de idioma.'
  },
  {
    from: '/en-us/services/facebook-instagram-ads.html', to: null, status: 'hold',
    reason: 'Meta Ads em inglês exige equivalência editorial e hreflang.'
  },
  {
    from: '/en-us/services/google-ads-anuncios.html', to: null, status: 'hold',
    reason: 'Google Ads em inglês exige equivalência editorial e hreflang.'
  },
  {
    from: '/en-us/services/linkedin-ads-anuncios.html', to: null, status: 'hold',
    reason: 'LinkedIn Ads em inglês sem serviço equivalente no catálogo atual.'
  },
  {
    from: '/en-us/services/marketplace-amazon.html', to: null, status: 'hold',
    reason: 'Marketplace Amazon em inglês sem serviço equivalente no catálogo.'
  },
  {
    from: '/en-us/services/marketplace-mercado-livre.html', to: null, status: 'hold',
    reason: 'Marketplace Mercado Livre em inglês sem destino comercial homologado.'
  }
]);
