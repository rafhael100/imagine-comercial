/**
 * F269: read exact, quoted HTML attributes from statically generated tags.
 * Prefix attributes (data-href, data-rel) and values mentioning e.g. rel=
 * are never accepted as the actual SEO attribute. No DOM or network needed.
 */
const OPEN=/^<([A-Za-z][A-Za-z0-9:-]*)(?=[\s>])/;
const FIELD=/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/y;

export function readStrictHtmlAttribute(tag,target){
  if(typeof tag!=='string'||!tag.endsWith('>')||
     typeof target!=='string'||!/^[a-z][a-z0-9:-]*$/.test(target))
    throw Error('F269: invalid tag or attribute name');
  const match=OPEN.exec(tag);
  if(!match)throw Error('F269: invalid opening tag');
  let attrs=tag.slice(match[0].length,-1).trimEnd();
  if(attrs.endsWith('/'))attrs=attrs.slice(0,-1).trimEnd();
  let at=0,found=null;
  while(at<attrs.length){
    while(at<attrs.length&&/\s/.test(attrs[at]))at++;
    if(at===attrs.length)break;
    FIELD.lastIndex=at;
    const part=FIELD.exec(attrs);
    if(!part)throw Error('F269: malformed tag attributes');
    at=FIELD.lastIndex;
    if(part[1].toLowerCase()===target){
      if(found!==null)throw Error('F269: duplicate SEO attribute');
      if(part[2]===undefined&&part[3]===undefined)
        throw Error('F269: SEO attribute must be quoted');
      found=part[2]??part[3];
    }
  }
  return found;
}
