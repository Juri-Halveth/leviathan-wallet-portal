// Display local wall time; calculation duration and simulation lifetime use a monotonic clock separately.
export function startClock(element){
  if(!element)return;
  const format=new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Berlin'});
  const tick=()=>{const now=new Date();element.dateTime=now.toISOString();element.textContent=format.format(now)+' · Berlin';element.title='Lokale Systemuhr, unkalibriert · UTC '+now.toISOString();};
  tick();return setInterval(tick,1000);
}
