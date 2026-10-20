// Reference valuation only. Base amounts remain exact decimal strings.
const colors={balance:'#b8ee7d',stake:'#53cbb5',unbonding:'#f1c66e',rewards:'#b7a0ef',other:'#7fafe8',pool:'#8de4e7'};
export const groups=[['balance','In der Wallet'],['stake','Im Staking'],['unbonding','In Freigabe'],['rewards','Erträge'],['other','Weitere Coins'],['pool','In Pools']];
export {colors};
function fraction(value){
  const text=String(value),match=/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(text);
  if(!match||text.length>250)throw Error('Ungültiger Mengen- oder Kurswert');
  const exponent=Number(match[3]||0)-(match[2]||'').length;
  if(Math.abs(exponent)>100)throw Error('Wertebereich überschritten');
  const n=BigInt(match[1]+(match[2]||''));
  return exponent>=0?[n*10n**BigInt(exponent),1n]:[n,10n**BigInt(-exponent)];
}
export function shortId(value,edge=8){const s=String(value||'');return s.length>edge*2+3?s.slice(0,edge)+'…'+s.slice(-edge):s;}
export function quantity(raw,decimals){
  if(!Number.isInteger(decimals)||decimals<0||decimals>30){const [whole,tail='']=String(raw).split('.');return BigInt(whole).toLocaleString('de-DE')+(tail?','+tail:'');}
  const [whole,part='']=String(raw).split('.'),digits=(whole+part).padStart(decimals+part.length+1,'0'),split=digits.length-decimals-part.length;
  const integer=digits.slice(0,split),fractional=digits.slice(split).replace(/0+$/,'');
  return BigInt(integer).toLocaleString('de-DE')+(fractional?','+fractional.slice(0,6)+(fractional.slice(6).replace(/0/g,'')?'…':''):'');
}
export function sumRawAmounts(values){
  const scale=Math.max(0,...values.map(x=>(String(x).split('.')[1]||'').length));
  const sum=values.reduce((s,x)=>{const [a,b='']=String(x).split('.');return s+BigInt(a+b.padEnd(scale,'0'));},0n).toString().padStart(scale+1,'0');
  return scale?sum.slice(0,-scale)+'.'+sum.slice(-scale):sum;
}
export function money(cents,currency='eur'){
  if(cents===null||cents===undefined)return 'Kurs offen';
  const n=BigInt(cents);return (n/100n).toLocaleString('de-DE')+','+(n%100n).toString().padStart(2,'0')+'\u00a0'+(currency==='eur'?'€':'US$');
}
export function metadataFor(chain,base,valuation){
  const bound=valuation?.metadata?.[chain.id]?.assets?.find(a=>a.base===base);
  if(bound)return bound;
  const old=chain.assets?.find(a=>a.base===base);
  if(old)return {base,name:old.name,symbol:old.symbol,decimals:old.denom_units?.find(x=>x.denom===old.display)?.exponent};
  if(base===chain.denom)return {base,name:chain.name,symbol:chain.symbol,decimals:chain.decimals,coingeckoId:chain.coingeckoId||null};
  return {base,name:null,symbol:null,decimals:null,coingeckoId:null};
}
export function buildPortfolio(data,chain,valuation,currency='eur'){
  const rows=[];
  function add(kind,base,raw,details={}){
    const meta=data.tokenMetadata?.[base]||metadataFor(chain,base,valuation),price=valuation?.prices?.[meta.coingeckoId],p=price?.[currency];
    let cents=null;
    if(Number.isInteger(meta.decimals)&&Number.isFinite(p)&&p>0){const [a,b]=fraction(raw),[q,r]=fraction(p),den=b*r*10n**BigInt(meta.decimals);cents=(a*q*100n+den/2n)/den;}
    rows.push({id:kind+':'+rows.length,kind,base,raw:String(raw),meta,price:p,priceAt:price?.last_updated_at?new Date(price.last_updated_at*1000).toISOString():valuation?.fetchedAt,valueCents:cents,quantity:quantity(raw,meta.decimals),...details});
  }
  if(chain.kind==='cosmos'){
    if(data.balances){const bank=[...data.balances];if(!bank.some(x=>x.denom===chain.denom))bank.unshift({denom:chain.denom,amount:'0'});for(const c of bank)add(c.denom===chain.denom?'balance':'other',c.denom,c.amount);}
    for(const d of data.delegations||[])add('stake',d.balance.denom,d.balance.amount,{validator:d.delegation.validator_address});
    for(const d of data.unbondings||[])for(const entry of d.entries||[])add('unbonding',chain.denom,entry.balance,{validator:d.validator_address,completionTime:entry.completion_time});
    for(const r of data.rewards||[])if(!/^0(?:\.0+)?$/.test(r.amount))add('rewards',r.denom,r.amount);
  }else if(chain.kind==='evm'){
    if(data.balances)for(const c of data.balances)add(c.denom===chain.denom?'balance':'other',c.denom,c.amount);
    for(const p of data.poolPositions||[])add('pool',p.base,p.amount,{protocol:p.protocol,poolAddress:p.poolAddress,poolDetails:p});
  }else{
    add('balance','ALGO',data.amount);
    for(const a of data.assets||[])if(Number.isSafeInteger(a.amount))add('other','ASA:'+a['asset-id'],String(a.amount),{frozen:a['is-frozen']});
  }
  const total=rows.reduce((sum,r)=>sum+(r.valueCents??0n),0n),unpriced=rows.filter(r=>r.valueCents===null),missing=[...(data.errors||[]).map(e=>e.part||'Abfrage'),...(data.partial||[])];
  const split=groups.map(([id,label])=>({id,label,color:colors[id],cents:rows.filter(r=>r.kind===id).reduce((sum,r)=>sum+(r.valueCents??0n),0n)}));
  return {rows,total,unpriced,pricedCount:rows.length-unpriced.length,missing,split,currency,partial:unpriced.length>0||missing.length>0};
}
