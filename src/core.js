import { fromBech32 } from '@cosmjs/encoding';
export const CHAIN = 'Oraichain';
export function address(value, prefix='orai') {
  const input=value.trim();
  const decoded=fromBech32(input,90);
  if(decoded.prefix!==prefix || ![20,32].includes(decoded.data.length)) throw new Error('Ungültige '+prefix+'-Adresse.');
  return input;
}
export function rawAmount(value) {
  const text=String(value).trim();
  if(!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(text)) throw new Error('Betrag: positive Dezimalzahl mit Punkt und höchstens 6 Nachkommastellen eingeben.');
  const [whole,frac='']=text.split('.');
  const result=BigInt(whole)*1000000n+BigInt(frac.padEnd(6,'0'));
  if(result>(1n<<128n)-1n) throw new Error('Betrag überschreitet Uint128.');
  return result.toString();
}
export function orai(raw) {const n=BigInt(raw);const f=(n%1000000n).toString().padStart(6,'0').replace(/0+$/,'');return (n/1000000n).toString()+(f?'.'+f:'');}
export function message(text) {
  const value=JSON.parse(text);
  const stack=[];
  for(let i=0;i<text.length;i++){
    if(text[i]==='{')stack.push(new Set());
    else if(text[i]==='[')stack.push(null);
    else if(text[i]==='}'||text[i]===']')stack.pop();
    else if(text[i]==='"'){
      const start=i;
      for(i++;i<text.length;i++){if(text[i]==='\\')i++;else if(text[i]==='"')break;}
      let next=i+1;while(/\s/.test(text[next]||'')&&next<text.length)next++;
      if(text[next]===':'){
        const key=JSON.parse(text.slice(start,i+1)),keys=stack.at(-1);
        if(keys.has(key))throw new Error('Doppelter JSON-Schlüssel: '+key);
        keys.add(key);
      }
    }
  }
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).length!==1) throw new Error('Die Contract-Nachricht muss ein JSON-Objekt mit genau einer Aktion sein.');
  return value;
}
export function endpoint(value) {const url=new URL(value);if(url.protocol!=='https:')throw new Error('Für Mainnet-Endpunkte wird HTTPS benötigt.');return url.href.replace(/\/$/,'');}
export function assertFresh(prepared,snapshot,sender,now=Date.now(),monotonicNow=performance.now()) {
  if(!prepared || prepared.snapshot!==snapshot || prepared.sender!==sender) throw new Error('Eingaben oder Wallet wurden geändert. Erneut simulieren.');
  if(!Number.isFinite(now)||!Number.isFinite(prepared.time)||!Number.isFinite(monotonicNow)||!Number.isFinite(prepared.monotonicTime)||prepared.monotonicTime<0||monotonicNow<prepared.monotonicTime||now<prepared.time)throw new Error('Zeitbasis hat sich geändert. Erneut simulieren.');
  if(now-prepared.time>=60000||monotonicNow-prepared.monotonicTime>=60000) throw new Error('Simulation ist mindestens 60 Sekunden alt. Erneut simulieren.');
}
