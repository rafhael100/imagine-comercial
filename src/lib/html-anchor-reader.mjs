/**
 * F268: read actual href attributes from compiled HTML anchors.
 * Avoid mistaking data-href / aria-href / quoted attribute contents for
 * navigable links. This is a bounded static audit, not a DOM parser.
 */
const ATTRIBUTE=/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/y;
const HTML_TAG=/^<\/?([a-z][a-z0-9:-]*)(?=[\s/>])/i;
const RAW_TEXT=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes']);

/**
 * F286: scan actual HTML tag boundaries, respecting quoted attributes and
 * comment/raw-text/template contexts. This remains a bounded compiled-HTML
 * audit, not a replacement for a browser's parser or a sanitizer.
 */
export function anchorOpeningTags(html){
  if(typeof html!=='string')throw Error('F268: compiled HTML required');
  const tags=[];
  let at=0,templateDepth=0;
  while((at=html.indexOf('<',at))!==-1){
    if(html.startsWith('<!--',at)){
      const end=html.indexOf('-->',at+4);
      at=end<0?html.length:end+3;
      continue;
    }
    const opening=HTML_TAG.exec(html.slice(at));
    if(!opening){at++;continue;}
    const name=opening[1].toLowerCase();
    const closing=html[at+1]==='/';
    let quote=null,end=-1;
    for(let i=at+opening[0].length;i<html.length;i++){
      const ch=html[i];
      if(quote){
        if(ch===quote)quote=null;
        continue;
      }
      if(ch==='"'||ch==="'"){quote=ch;continue;}
      if(ch==='<')throw Error('F268: malformed opening tag');
      if(ch==='>'){end=i;break;}
    }
    if(end<0)throw Error('F268: unterminated opening tag');
    if(name==='template'){
      // A template's fragment is inert even with nested templates.
      if(closing)templateDepth=Math.max(0,templateDepth-1);
      else templateDepth++;
    }else if(!closing&&RAW_TEXT.has(name)){
      // The browser treats these contents as raw text/RCDATA, not links.
      // A missing closing tag consumes the remainder, never inventing URLs.
      const close=new RegExp('<\\/'+name+'\\s*>','gi');
      close.lastIndex=end+1;
      const match=close.exec(html);
      at=match?close.lastIndex:html.length;
      continue;
    }else if(!closing&&name==='a'&&templateDepth===0){
      tags.push(html.slice(at,end+1));
    }
    at=end+1;
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
