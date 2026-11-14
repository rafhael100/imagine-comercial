/**
 * F34 — Evidência pública OBSERVADA no menu e no conteúdo de serviços do
 * domínio legado da Imagine em 09/11/2026, sem autenticação ou crawler.
 * Fonte: navegação pública no próprio site, NÃO dados de Search Console.
 * Snapshot acessível não comprova HTTP 200 AO VIVO, indexação, backlinks,
 * equivalência editorial ou autorização para publicar redirecionamentos.
 */
const source='https://www.imaginecomunicacao.com.br';

const servicePaths=[
  '/o-que-fazemos/criacao-de-sites-institucional.html',
  '/o-que-fazemos/criacao-de-loja-virtual.html',
  '/o-que-fazemos/google-ads-anuncios.html',
  '/o-que-fazemos/facebook-instagram-ads.html',
  '/o-que-fazemos/youtube-ads-anuncios.html',
  '/o-que-fazemos/linkedin-ads-anuncios.html',
  '/o-que-fazemos/marketplace-amazon.html',
  '/o-que-fazemos/marketplace-mercado-livre.html'
];

export const publicLegacyEvidence=Object.freeze(servicePaths.map(path=>Object.freeze({
  path,
  officialSourceUrl:source+path,
  observedOn:'2026-11-09',
  discovery:'official_homepage_service_navigation',
  evidence:'public_page_content_visible_in_retrieved_snapshot',
  httpStatusNow:null,
  searchConsoleVerified:false,
  editorialEquivalenceVerified:false,
  approval:'HOLD_FOR_INDIVIDUAL_EDITORIAL_AND_SEO_REVIEW'
})));
