import { interpretSecurityStatus } from './security-claims.mjs';
const title = document.querySelector('#report-title');
const intro = document.querySelector('#report-detail');
const grid = document.querySelector('#controls');
function printError(msg) {
  title.textContent = 'Keine vertrauenswürdige Statusaussage';
  intro.textContent = msg;
  grid.replaceChildren();
}
try {
  const response = await fetch('./security-status.json', {cache: 'no-store'});
  if (!response.ok) throw Error('Statusdatei nicht erreichbar (HTTP ' + response.status + ')');
  const result = interpretSecurityStatus(await response.json());
  title.textContent = result.title;
  intro.textContent = result.explanation;
  grid.replaceChildren();
  for (const check of result.checks) {
    const li = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = check.label;
    const state = document.createElement('span');
    state.textContent = check.status;
    li.append(label, state);
    grid.append(li);
  }
} catch (error) {
  printError('Status nicht bestätigt: ' + String(error?.message || error));
}
