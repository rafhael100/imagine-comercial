import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('F243 old GSC JSON runbook cannot instruct private artifact persistence',()=>{
  const doc=read('docs/F68-IMPORTACAO-PRIVADA-GSC-JSON.md');
  assert.match(doc,/F242 substituiu a gravação antiga/);
  assert.match(doc,/não grava nenhum relatório/);
  assert.doesNotMatch(doc,/Grava o resultado em `artifacts\/gsc-review\/`/);
});
test('F243 CSV runbook distinguishes synthetic CI artifacts from real private inputs',()=>{
  const doc=read('docs/F26-GSC-CSV-OFFLINE-INVENTORY.md');
  assert.match(doc,/modo `--file` privado, não grava relatórios/);
  assert.match(doc,/execução `--synthetic` na CI/);
});
test('F243 release handoff tracks approved visual brand and GSC confidentiality',()=>{
  const status=read('STATUS-ATUAL.md');
  for(const id of ['F238 #297','F239 #298','F240 #300','F241 #301','F242 #302'])
    assert.ok(status.includes(id),'Missing DEV increment '+id);
  assert.match(status,/logomarca original do primeiro Portal Node/);
  assert.match(status,/não grava dados derivados/);
});
