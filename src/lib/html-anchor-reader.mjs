/**
 * F268: read actual href attributes from compiled HTML anchors.
 * Avoid mistaking data-href / aria-href / quoted attribute contents for
 * navigable links. This is a bounded static audit, not a DOM parser.
 */
import {activeHtmlTokens} from './active-html-reader.mjs';

const ATTRIBUTE=/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/y;

/**
 * F286: scan actual HTML tag boundaries, respecting quoted attributes and
 * comment/raw-text/template contexts. This remains a bounded compiled-HTML
 * audit, not a replacement for a browser's parser or a sanitizer.
 */
export function anchorOpeningTags(html){
  return activeHtmlTokens(html)
    .filter(token=>!token.closing&&token.name==='a').map(token=>token.raw);
}

export function requiredAnchorHref(tag){
  if(typeof tag!=='string'||!/^<a(?=[\s>])/i.test(tag)||!tag.endsWith('>'))
    throw Error('F268: invalid opening anchor');
  const attrs=tag.slice(2,-1);
  let at=0,href=null;
  while(at<attrs.length){
    while(at<attrs.length&&/\s/.test(attrs[at]))at++;
    if(at===attrs.length)break;
    ATTRIBUTE.lastIndex=at;
    const found=ATTRIBUTE.exec(attrs);
    if(!found)throw Error('F268: invalid anchor attributes');
    at=ATTRIBUTE.lastIndex;
    if(found[1].toLowerCase()==='href'){
      if(href!==null)throw Error('F268: duplicate href attribute');
      if(found[2]===undefined&&found[3]===undefined)
        throw Error('F268: href must be quoted');
      href=found[2]??found[3];
    }
  }
  if(href===null)throw Error('F268: link without href attribute');
  return href;
}
