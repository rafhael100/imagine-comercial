import { renderDemo } from '../build-demo.mjs';

/** Build-time extraction from the reviewed standalone document; no user input. */
export async function renderLabView({ sourceRoot, transport = 'local' } = {}) {
  if (!['local', 'loopback_http'].includes(transport)) throw new TypeError('Unknown laboratory transport.');
  const result = await renderDemo(sourceRoot === undefined ? {} : { sourceRoot });
  const body = result.html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  const css = result.html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)?.[1];
  if (typeof body !== 'string' || typeof css !== 'string') throw new Error('Invalid Faísca laboratory template.');
  // Astro performs its own module bundling. Never evaluate the standalone script here.
  let markup = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  if (transport === 'loopback_http') {
    // Trusted, build-time copy only. Keep the approved artwork and standalone
    // template intact while accurately describing this different transport.
    const replacements = [
      ['Ative JavaScript para experimentar a conversa guiada local. Nenhuma informação é enviada a serviços.',
        'Ative JavaScript para testar a conversa com o servidor local. Use apenas mensagens fictícias; nenhuma IA externa está conectada.'],
      ['Nesta prévia, as respostas são roteiros locais. Nenhum atendimento, pedido ou contato é enviado.',
        'Nesta prévia, as mensagens de teste passam pelo servidor local. Nenhum atendimento é enviado à equipe, ao CRM ou ao Portal.'],
      ['Esta é a primeira demonstração do atendimento guiado. Você pode conversar, explorar opções e copiar um resumo das escolhas. O histórico fica apenas nesta página e é apagado ao recomeçar ou recarregar.',
        'Este laboratório usa um servidor no seu computador para responder a mensagens fictícias. O servidor mantém registros temporários, que expiram após um período limitado ou ao encerrar o processo. Reiniciar pede o descarte da sessão; recarregar a página não comprova que uma mensagem já recebida foi cancelada.']
    ];
    for (const [before, after] of replacements) {
      if (!markup.includes(before)) throw new Error('Laboratory transport notice requires review.');
      markup = markup.replace(before, after);
    }
  }
  if (/<script\b/i.test(markup) || /__FAISCA_[A-Z_]+__/.test(markup)) throw new Error('Unsafe laboratory fragment.');
  return Object.freeze({ markup, css, image_sha256: result.image_sha256, mode: result.mode });
}
