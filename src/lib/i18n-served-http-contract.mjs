/**
 * F-I18N-EDGE: validate actual public HTTP HTML returned by local Workerd.
 * Independent of build-file assertions; validates the served language switcher,
 * SEO alternates, and human-readable language metadata on all curated pages.
 * No network access, cookies, clients, secrets, redirects or production write.
 */
import {sitePages,toAbsoluteUrl} from '../data/services.mjs';
import {languageAlternates,languageSwitchTargets} from '../data/i18n.mjs';

const knownRoutes=new Set(sitePages.map(page=>page.path));
const languages=Object.freeze(['pt-BR','en','es']);
const allAlternates=Object.freeze([...languages,'x-default']);
const safeAttribute=(name,tag)=>{
  const pattern=new RegExp('(?:^|\\s)'+name+'="([^"]*)"','g');
  const matches=[...tag.matchAll(pattern)].map(x=>x[1]);
  if(matches.length!==1)throw Error('F-I18N-EDGE: missing or duplicate required HTML attribute');
  return matches[0];
};
const tags=(markup,type)=>[...markup.matchAll(new RegExp('<'+type+'\\b[^>]*>','gi'))].map(m=>m[0]);

export function verifyServedLanguageParity(html,path){
  if(typeof html!=='string'||Buffer.byteLength(html,'utf8')>1024*1024||
    typeof path!=='string'||!knownRoutes.has(path))
    throw Error('F-I18N-EDGE: unexpected HTTP route or HTML');
  const matched=html.match(/^\s*<!doctype html[^>]*>\s*(<html\b[^>]*>)/i)||
    html.match(/(<html\b[^>]*>)/i);
  if(!matched)throw Error('F-I18N-EDGE: root HTML is missing');
  const lang=safeAttribute('lang',matched[1]);
  const expectedLang=path.startsWith('/en/')?'en':path.startsWith('/es/')?'es':'pt-BR';
  if(lang!==expectedLang)
    throw Error('F-I18N-EDGE: served root language differs from route');

  const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1];
  if(!head)throw Error('F-I18N-EDGE: missing HTML head');
  const canonical=tags(head,'link').filter(tag=>{
    const rel=(tag.match(/(?:^|\s)rel="([^"]*)"/)?.[1]??'').split(/\s+/);
    return rel.includes('canonical');
  });
  if(canonical.length!==1 || safeAttribute('href',canonical[0])!==toAbsoluteUrl(path))
    throw Error('F-I18N-EDGE: canonical URL must match actual public route');

  const declared=languageAlternates(path);
  const requiredFlags=languageSwitchTargets(path);
  if(!declared||!requiredFlags)
    throw Error('F-I18N-EDGE: unavailable review-approved language mapping');

  const links=tags(head,'link').filter(tag=>(tag.match(/(?:^|\s)rel="([^"]*)"/)?.[1]??'')
    .split(/\s+/).includes('alternate') && /\shreflang=/.test(tag));
  if(links.length!==4)
    throw Error('F-I18N-EDGE: four exact hreflang alternates required');
  const seen=new Set();
  for(const tag of links){
    if(safeAttribute('rel',tag)!=='alternate')throw Error('F-I18N-EDGE: alternate rel invalid');
    const locale=safeAttribute('hreflang',tag);
    if(!allAlternates.includes(locale)||seen.has(locale)||
      safeAttribute('href',tag)!==toAbsoluteUrl(declared[locale]))
      throw Error('F-I18N-EDGE: alternate mapping mismatch');
    seen.add(locale);
  }
  if(allAlternates.some(lang=>!seen.has(lang)))
    throw Error('F-I18N-EDGE: missing language counterpart');

  const switcher=html.match(/<nav\b[^>]*class="locale-switcher"[^>]*>([\s\S]*?)<\/nav>/i);
  if(!switcher)throw Error('F-I18N-EDGE: missing visible language switcher');
  const flags=tags(switcher[1],'a');
  if(flags.length!==3)throw Error('F-I18N-EDGE: exactly three country/language choices required');
  let activeCount=0;const chosen=new Set();
  for(const flag of flags){
    const language=safeAttribute('lang',flag);
    if(!languages.includes(language)||chosen.has(language)||
      safeAttribute('hreflang',flag)!==language||
      safeAttribute('href',flag)!==requiredFlags[language]||
      safeAttribute('class',flag)!=='locale-option'||
      safeAttribute('aria-label',flag).length<4)
      throw Error('F-I18N-EDGE: missing or incorrect language flag link');
    chosen.add(language);
    const current=flag.match(/(?:^|\s)aria-current="([^"]*)"/g)??[];
    if(language===lang){
      if(current.length!==1||!current[0].includes('page'))
        throw Error('F-I18N-EDGE: selected language must be current');
      activeCount++;
    }else if(current.length!==0)
      throw Error('F-I18N-EDGE: another language cannot be current');
  }
  if(activeCount!==1||chosen.size!==3)
    throw Error('F-I18N-EDGE: missing exact selected language');
  return Object.freeze({
    path,language:lang,alternatesVerified:4,flagLinksVerified:3,
    selectedLanguageVerified:true,actualHttpHtmlVerified:true
  });
}
