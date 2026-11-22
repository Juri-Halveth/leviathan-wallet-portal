import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {interpretSecurityStatus} from '../site/security-claims.mjs';
const data=JSON.parse(readFileSync(new URL('../site/security-status.json',import.meta.url),'utf8'));
const clone=()=>structuredClone(data);
test('preview never calls a control verified',()=>{
  const result=interpretSecurityStatus(data);
  assert.equal(result.checks.length,4);
  assert.ok(result.checks.every(x=>x.status==='Nicht verifiziert'));
  assert.match(result.explanation,/KEINE verifizierte/);
});
test('forged enabled state fails closed',()=>{
  const fake=clone();fake.controls.hardwareSsh='VERIFIED';
  assert.throws(()=>interpretSecurityStatus(fake),/Nicht geprüfter/);
});
test('claimed signature fails closed',()=>{
  const fake=clone();fake.evidence.signature='VALID';
  assert.throws(()=>interpretSecurityStatus(fake),/Signaturbehauptung/);
});
test('no source timestamp or revision may be invented',()=>{
  const fake=clone();fake.sourceCommit='deadbeef';
  assert.throws(()=>interpretSecurityStatus(fake),/Belegbehauptung/);
  const v2=clone();v2.schema='halveth.security-transparency.v2';
  assert.throws(()=>interpretSecurityStatus(v2),/Schema/);
});
test('unknown controls fail closed',()=>{
  const fake=clone();fake.controls.sshRoot=true;
  assert.throws(()=>interpretSecurityStatus(fake),/Unbekannte Kontrollfelder/);
});
test('public claim file contains no local identifiers or secrets',()=>{
  const text=JSON.stringify(data).toLowerCase();
  for(const s of ['192.168.','10.0.','privatekey','seedphrase','ssh-ed25519 ','passwort','password','recoverykey']) assert.ok(!text.includes(s),s);
});
