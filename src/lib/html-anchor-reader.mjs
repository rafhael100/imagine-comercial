/**
 * F268: read actual href attributes from compiled HTML anchors.
 * Avoid mistaking data-href / aria-href / quoted attribute contents for
 * navigable links. This is a bounded static audit, not a DOM parser.
 */
const TAG_START=/<a(?=[\s>])/gi;
const ATTRIBUTE=/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/y;

export function anchorOpeningTags(html){
  if(typeof html!=='string')throw Error('F268: compiled HTML required');
  // F275: browser-inert comments, scripts, styles and templates cannot
  // contribute navigable links. Keep noscript: those links are genuinely
  // navigable when JavaScript is disabled.
  const source=html.replace(/<!--[\s\S]*?(?:-->|$)/g,'')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const tags=[];
  TAG_START.lastIndex=0;
  let match;
  while((match=TAG_START.exec(source))!==null){
    const begin=match.index;
    let quote=null, end=-1;
    for(let i=begin+2;i<source.length;i++){
      const ch=source[i];
      if(quote){
        if(ch===quote)quote=null;
        continue;
      }
      if(ch==='"'||ch==="'"){quote=ch;continue;}
      if(ch==='<')throw Error('F268: malformed anchor opening tag');
      if(ch==='>'){end=i;break;}
    }
    if(end<0)throw Error('F268: unterminated anchor opening tag');
    tags.push(source.slice(begin,end+1));
    TAG_START.lastIndex=end+1;
  }
  return tags;
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
