/** F306: pure CMS/public metadata merge, reusable without release I/O. */
export function mergeApprovedServiceMetadata(curated, snapshot) {
  if (!Array.isArray(curated) || !snapshot || !Array.isArray(snapshot.items)) {
    throw new Error('build catalog: validated snapshot and curated services required');
  }
  const known = new Map(curated.map(service => [service.slug, service]));
  const overrides = new Map();
  for (const item of snapshot.items) {
    const base = known.get(item.slug);
    if (!base) throw new Error('build catalog: unpublished editorial slug: ' + item.slug);
    if (overrides.has(item.slug)) throw new Error('build catalog: duplicate slug: ' + item.slug);
    if (item.path !== '/servicos/' + base.slug + '/') {
      throw new Error('build catalog: invalid approved path');
    }
    overrides.set(item.slug, item);
  }
  const merged=curated.map(base => {
    const next = overrides.get(base.slug);
    if (!next) return base;
    // Não sobrescrever slug, FAQ, links, descrição institucional ou preços.
    // A descrição publicada também fica visível no texto principal da página.
    return Object.freeze({
      ...base, title: next.title, description: next.description,
      intro: next.description
    });
  });
  // F198: a partially signed update must not silently duplicate SEO titles
  // or meta descriptions already present on any unchanged public page.
  // Compare the FINAL six-page catalog, not only the signed delta.
  const titles=new Set(),descriptions=new Set();
  for(const item of merged){
    if(typeof item.title!=='string'||typeof item.description!=='string')
      throw Error('build catalog: invalid public SEO metadata');
    const title=item.title.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
    const description=item.description.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
    if(titles.has(title))throw Error('build catalog: duplicate public title');
    if(descriptions.has(description))
      throw Error('build catalog: duplicate public description');
    titles.add(title);
    descriptions.add(description);
  }
  return Object.freeze(merged);
}

