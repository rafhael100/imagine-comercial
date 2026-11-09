export const prerender = true;

const paths = ['/', '/servicos/landing-pages/'];

export function GET() {
  const origin = 'https://imaginecomunicacao.com.br';
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + paths.map(path => '  <url><loc>' + origin + path + '</loc></url>').join('\n')
    + '\n</urlset>';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
