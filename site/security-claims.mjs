// Presentation validation only. This module NEVER verifies a node signature.
const controlNames = Object.freeze({
  hardwareSsh: 'SSH mit Hardware-Schlüssel',
  walletThreshold: 'Wallet mit Mehrfachfreigabe',
  sensitiveActionGate: 'Zusätzliche Freigabe sensibler Aktionen',
  recovery: 'Unabhängig getestete Wiederherstellung'
});
export function interpretSecurityStatus(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw Error('Kein JSON-Objekt');
  if (doc.schema !== 'halveth.security-transparency.v1' || doc.project !== 'LEVIATHAN' || doc.station !== 'LUCINETA') throw Error('Schema oder Quelle unbekannt');
  if (doc.publication !== 'PREVIEW_ONLY') throw Error('Nicht unterstützter Veröffentlichungsstatus');
  if (doc.observedAt !== null || doc.sourceCommit !== null) throw Error('Unzulässige Belegbehauptung in der Vorschau');
  if (!doc.evidence || doc.evidence.status !== 'NOT_ATTESTED' || doc.evidence.signature !== 'NOT_PRESENT' || doc.evidence.verification !== 'NOT_PERFORMED') throw Error('Unzulässige Signaturbehauptung');
  if (!doc.controls || typeof doc.controls !== 'object' || Array.isArray(doc.controls)) throw Error('Kontrollen fehlen');
  for (const key of Object.keys(controlNames)) if (doc.controls[key] !== 'NOT_VERIFIED') throw Error('Nicht geprüfter Kontrollzustand: ' + key);
  if (Object.keys(doc.controls).length !== Object.keys(controlNames).length) throw Error('Unbekannte Kontrollfelder');
  return {
    title: 'Vorschau, keine Node-Attestierung',
    explanation: 'Die öffentliche Ansicht zeigt derzeit KEINE verifizierte Hardware-Schlüsselpflicht, Wallet-Mehrfachfreigabe oder Live-Node-Sicherheit. Eine echte Attestierung benötigt einen vertrauenswürdig geprüften öffentlichen Schlüssel, eine signierte Momentaufnahme, Frischeprüfung und unabhängige Verifikation.',
    checks: Object.entries(controlNames).map(([key, label]) => ({label, status:'Nicht verifiziert'}))
  };
}
