import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

function astroFiles(folder) {
  return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>{
    const path=join(folder,entry.name);
    return entry.isDirectory()?astroFiles(path):
      entry.isFile()&&entry.name.endsWith('.astro')?[path]:[];
  });
}
test('F31: future lead intake lab is never imported or enabled by public Astro routes',()=>{
  const files=[
    ...astroFiles('src/pages'),
    ...astroFiles('src/components'),
    ...astroFiles('src/layouts')
  ];
  assert.ok(files.length>=8,'Expected public Astro pages, layout and components');
  for(const path of files){
    const source=readFileSync(path,'utf8');
    assert.doesNotMatch(source,/lead-intake-lab|PUBLIC_LEAD_CAPTURE_URL|\/api\/leads\b/i,
      path+' must not activate the synthetic CRM inbox');
    assert.doesNotMatch(source,/<form\b|fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/i,
      path+' must not transmit PII without approved intake/privacy');
  }
});
test('F31: synthetic model cannot appear in public static deployment artifacts',()=>{
  const fs=readFileSync('src/lib/lead-intake-lab.mjs','utf8');
  assert.match(fs,/SYNTHETIC_IN_MEMORY_NO_NETWORK/);
  assert.match(fs,/explicit contact consent required/);
  assert.match(fs,/idempotency conflict/);
  const page=readFileSync('src/pages/contato.astro','utf8');
  assert.match(page,/Nenhum dado será enviado pelo site/);
  assert.match(page,/formulário integrado ao Portal será disponibilizado após homologação/);
});
