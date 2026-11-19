/**
 * F153 — deterministic table-of-contents anchors for reviewed articles.
 * No client-side parsing, network access, tracking or dynamic routes.
 */
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;

export function editorialHeadingId(value){
  if(typeof value!=='string'||value.trim()!==value||
    value.length<6||value.length>220)
    throw Error('F153: invalid editorial heading');
  const id=value.normalize('NFKD').replace(/\p{M}/gu,'')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,80).replace(/-+$/,'');
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
    throw Error('F153: unaddressable editorial heading');
  return id;
}

export function createEditorialOutline(article){
  if(!plain(article)||!Array.isArray(article.sections)||
    article.sections.length<2||article.sections.length>25)
    throw Error('F153: invalid article sections');
  const ids=new Set();
  const results=article.sections.map(section=>{
    if(!Array.isArray(section)||section.length<2||
      typeof section[0]!=='string'||
      section.slice(1).some(p=>typeof p!=='string'||p.trim().length<30))
      throw Error('F153: invalid article section');
    const id=editorialHeadingId(section[0]);
    if(ids.has(id))throw Error('F153: duplicate section identifier');
    ids.add(id);
    return Object.freeze({
      id,
      heading:section[0],
      paragraphs:Object.freeze(section.slice(1))
    });
  });
  return Object.freeze(results);
}
