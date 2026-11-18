/**
 * Shared compiled-HTML scanner extracted from the F286 anchor reader.
 * Quoted examples, declarations, comments, raw text and nested templates
 * cannot invent tags.
 * This preserves the existing static audit policy, including noscript fallback;
 * it is not a browser DOM parser, sanitizer or a proof of rendered content.
 */
const HTML_TAG=/^<\/?([a-z][a-z0-9:-]*)(?=[\s/>])/i;
const RAW_TEXT=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes']);

export function activeHtmlTokens(html){
  if(typeof html!=='string')throw Error('F268: compiled HTML required');
  const tokens=[];
  let at=0,templateDepth=0;
  while((at=html.indexOf('<',at))!==-1){
    if(html.startsWith('<!--',at)){
      const end=html.indexOf('-->',at+4);
      at=end<0?html.length:end+3;
      continue;
    }
    if(html.startsWith('<!',at)||html.startsWith('<?',at)){
      // In HTML, DOCTYPE (even a quoted identifier), bogus declarations and
      // processing instructions end at the first >. Later tags remain active.
      const end=html.indexOf('>',at+2);
      at=end<0?html.length:end+1;
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
    const token={name,closing,raw:html.slice(at,end+1),start:at,end:end+1};
    if(name==='template'){
      if(closing)templateDepth=Math.max(0,templateDepth-1);
      else templateDepth++;
    }else if(!closing&&RAW_TEXT.has(name)){
      // The opening token is active, but its contents never supply more tags.
      // A null closingStart preserves the distinction between paired content
      // and raw text that consumes the remainder of an incomplete document.
      const close=new RegExp('<\\/'+name+'\\s*>','gi');
      close.lastIndex=end+1;
      const match=close.exec(html);
      if(templateDepth===0)tokens.push({...token,closingStart:match?.index??null});
      at=match?close.lastIndex:html.length;
      continue;
    }else if(templateDepth===0){
      tokens.push(token);
    }
    at=end+1;
  }
  return tokens;
}
