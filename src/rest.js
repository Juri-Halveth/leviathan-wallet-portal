import { endpoint } from './core.js';

export async function readRest(base, path) {
  const url = endpoint(base) + path;
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(20000) }); }
  catch (cause) { throw new Error('Datenquelle nicht erreichbar (' + new URL(url).host + '). Erneut aktualisieren oder den REST-Endpunkt prüfen.', { cause }); }
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { /* HTTP status is still meaningful for HTML error pages. */ }
  if (!response.ok) {
    const reason = response.status === 501 ? 'Diese REST-Schnittstelle ist am gewählten Node nicht implementiert.' :
      response.status === 429 ? 'Die Datenquelle begrenzt gerade die Anfragen. Bitte später aktualisieren.' :
      'Die Datenquelle hat die Abfrage abgewiesen.';
    // No account addresses or arbitrary remote response text in diagnostics.
    const route = path.split('/').filter(Boolean).slice(0, 4).join('/');
    const error = new Error(reason + ' HTTP ' + response.status + ' · ' + new URL(url).host + ' · /' + route);
    error.httpStatus = response.status;
    throw error;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Die Datenquelle liefert kein gültiges JSON-Objekt.');
  return data;
}

export async function readBalance(base, account) {
  try {
    const data = await readRest(base, '/cosmos/bank/v1beta1/spendable_balances/' + account + '?pagination.limit=1000');
    if (!Array.isArray(data.balances)) throw new Error('Unerwartetes Format für verfügbare Beträge.');
    return { ...data, kind: 'SPENDABLE' };
  } catch (error) {
    if (error.httpStatus !== 501) throw error;
    const data = await readRest(base, '/cosmos/bank/v1beta1/balances/' + account + '?pagination.limit=1000');
    if (!Array.isArray(data.balances)) throw new Error('Unerwartetes Bankguthaben-Format.');
    return { ...data, kind: 'BANK_TOTAL', warning: 'Bankguthaben angezeigt: Der Node unterstützt die Abfrage verfügbarer Beträge nicht (HTTP 501). Gebundene Beträge können enthalten sein.' };
  }
}
