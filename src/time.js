// The preview expires if either clock rolls back or reaches the time limit.
export function assertPreviewTime(wallStart, monotonicStart, wallNow=Date.now(), monotonicNow=performance.now()) {
  if (![wallStart, monotonicStart, wallNow, monotonicNow].every(Number.isFinite)
      || monotonicStart < 0 || wallNow < wallStart || monotonicNow < monotonicStart) {
    throw new Error('Zeitbasis hat sich geändert. Erneut simulieren.');
  }
  if (wallNow - wallStart >= 60000 || monotonicNow - monotonicStart >= 60000) {
    throw new Error('Simulation ist mindestens 60 Sekunden alt. Erneut simulieren.');
  }
}

export function startClock(element){
  if(!element)return;
  const format=new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Berlin'});
  const tick=()=>{const now=new Date();element.dateTime=now.toISOString();element.textContent=format.format(now)+' · Berlin';element.title='Lokale Systemuhr, unkalibriert · UTC '+now.toISOString();};
  tick();return setInterval(tick,1000);
}
