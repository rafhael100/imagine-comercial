import { sitePages, toAbsoluteUrl } from '../data/services.mjs';

export const prerender = true;

export function GET() {
  const pages = [...new Set(sitePages.map(p => p.path))];
  const urls = pages.map(path => '<url><loc>' + toAbsoluteUrl(path) + '</loc></url>').join('\n');
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls + '\n</urlset>';
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
  });
}
