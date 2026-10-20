import {buildPortfolio,money,shortId,groups,quantity,sumRawAmounts} from './portfolio.js';
const $=id=>document.getElementById(id),node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
let current=null,currency='eur',valuation={metadata:{},prices:{}},validatorNames=new Map(),refreshing=false;
export function setValuation(value){valuation=value||valuation;render();}
export function getValuation(){return valuation;}
export function clearPortfolio(){current=null;render();}
export function showPortfolio(data,chain,receipt){current={data,chain,receipt};render();}
function quoteStatus(){return valuation.fetchedAt?'Kurse abgerufen: '+new Date(valuation.fetchedAt).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'})+' · CoinGecko':'Noch keine Referenzkurse geladen';}
function nativeAmount(kind,model){const rows=model.rows.filter(r=>r.kind===kind&&r.base===(current.chain.denom||'ALGO'));if(!rows.length)return '0 '+current.chain.symbol;return quantity(sumRawAmounts(rows.map(r=>r.raw)),rows[0].meta.decimals)+' '+current.chain.symbol;}
function details(row){
  const d=node('details','position-details'),s=node('summary','','Kennung & Herkunft');d.append(s);
  const list=node('dl');
  const values=[['Token-Kennung',row.base],['Rohmenge',row.raw],['Dezimalstellen',row.meta.decimals??'Noch nicht zugeordnet'],['Netzwerk',current.chain.name]];
  if(row.validator)values.push(['Validator',row.validator]);
  if(row.meta.coingeckoId)values.push(['Kurs-ID',row.meta.coingeckoId],['Kursstand',row.priceAt?new Date(row.priceAt).toLocaleString('de-DE'):'Offen']);
  for(const [k,v]of values)list.append(node('dt','',k),node('dd','',String(v)));
  d.append(list);return d;
}
function position(row){
  const box=node('article','holding-row'),head=node('div','holding-main'),icon=node('span','coin-avatar '+row.kind,(row.meta.symbol||'?').slice(0,4));
  const info=node('div','holding-info'),name=row.kind==='stake'?(validatorNames.get(row.validator)||'ORAI im Staking').replace(/^ORAI/,current.chain.symbol):row.kind==='unbonding'?'Freigabe läuft':row.kind==='rewards'?'Abholbare Erträge':row.meta.name||'Token noch nicht zugeordnet';
  info.append(node('h3','',name),node('p','holding-sub',current.chain.name+' · '+(groups.find(g=>g[0]===row.kind)?.[1]||'Token')));
  if(!row.meta.name)info.append(node('span','compact-id',shortId(row.base,12)));
  if(row.completionTime)info.append(node('p','holding-sub','Freigabe: '+new Date(row.completionTime).toLocaleString('de-DE')));
  const amounts=node('div','holding-amounts');amounts.append(node('strong','holding-money',money(row.valueCents,currency)),node('span','holding-quantity',row.quantity+' '+(row.meta.symbol||'Roh-Einheiten')));
  head.append(icon,info,amounts);box.append(head);
  if(current.chain.write&&row.kind==='stake'){
    const actions=node('div','holding-actions');
    for(const [mode,label]of [['delegate','Mehr anlegen'],['unstake','Freigeben'],['rewards','Erträge abholen'],['redelegate','Validator wechseln']]){
      const a=node('a','text-button',label+' ↗');a.href='console.html#'+new URLSearchParams({mode,validator:row.validator,watch:current.data.address});actions.append(a);
    }box.append(actions);
  }
  box.append(details(row));return box;
}
function render(){
  $('valuation-time').textContent=quoteStatus();
  for(const b of document.querySelectorAll('[data-currency]')){b.classList.toggle('active',b.dataset.currency===currency);b.setAttribute('aria-pressed',String(b.dataset.currency===currency));}
  if(!current){
    $('portfolio-title').textContent='Dein Portfolio';$('portfolio-total').textContent='—';$('portfolio-caption').textContent='Wallet anzeigen, dann siehst du Werte und Verteilung hier.';
    $('portfolio-network').textContent='Ein Netzwerk auswählen';$('portfolio-wallet').textContent='Deine Wallet bleibt bei dir';$('portfolio-coverage').textContent='Bereit für deine erste Abfrage';$('portfolio-read-time').textContent='Noch keine Wallet-Abfrage';
    $('allocation-donut').style.background='conic-gradient(#39594d 0% 100%)';$('allocation-center').textContent='—';$('allocation-legend').replaceChildren(node('p','allocation-empty','Verfügbar, Staking und Erträge im Verhältnis.'));
    for(const id of ['balance','stake','unbonding','rewards']){$('found-'+id).textContent='—';$('value-'+id).textContent='Nach Wallet-Abfrage';}
    $('positions').replaceChildren(node('div','positions-empty','Deine Coins und Staking-Positionen erscheinen hier.'));$('unknown-positions').replaceChildren();$('holdings-count').textContent='Nach deiner Wallet-Abfrage';$('unknown-assets').hidden=true;return;
  }
  const model=buildPortfolio(current.data,current.chain,valuation,currency);
  $('portfolio-title').textContent=model.partial?'Bekannter Teilwert':'Erfasster Portfoliowert';
  $('portfolio-total').textContent=model.pricedCount?money(model.total,currency):'Kurs offen';
  $('portfolio-caption').textContent='Bankguthaben + Staking + Freigaben + Erträge · '+current.chain.name;
  $('portfolio-network').textContent=current.chain.name;$('portfolio-wallet').textContent=shortId(current.data.address,10);
  $('portfolio-coverage').textContent=model.pricedCount+' von '+model.rows.length+' Positionen bewertet'+(model.unpriced.length?' · '+model.unpriced.length+' mit offenem Kurs':'')+(model.missing.length?' · Abfrage teilweise':'');
  $('portfolio-read-time').textContent='Wallet gelesen: '+new Date(current.data.completedAt||current.data.queriedAt).toLocaleTimeString('de-DE');
  for(const [kind]of groups.slice(0,4)){
    const apiPart={balance:'balances',stake:'delegations',unbonding:'unbondings',rewards:'rewards'}[kind];
    const available=current.chain.kind==='cosmos'?Array.isArray(current.data[apiPart]):kind==='balance';
    $('found-'+kind).textContent=available?nativeAmount(kind,model):'Nicht erfasst';
    const rows=model.rows.filter(r=>r.kind===kind),sum=rows.reduce((s,r)=>s+(r.valueCents??0n),0n);
    $('value-'+kind).textContent=available?(rows.some(r=>r.valueCents===null)?'Kurszuordnung offen':money(sum,currency)):'Schnittstelle offen';
  }
  const legend=$('allocation-legend');legend.replaceChildren();let cursor=0;const stops=[];
  const segments=model.split.filter(g=>g.cents>0n);
  for(const [index,g]of segments.entries()){const percent=model.total?Number(g.cents*1000000n/model.total)/10000:0,end=index===segments.length-1?100:cursor+percent;
    stops.push(g.color+' '+cursor+'% '+end+'%');cursor=end;
    const item=node('div','allocation-item'),left=node('span'),dot=node('i');dot.style.background=g.color;left.append(dot,document.createTextNode(g.label));item.append(left,node('strong','',percent<0.1?'< 0,1 %':percent.toLocaleString('de-DE',{maximumFractionDigits:1})+' %'));legend.append(item);
  }
  $('allocation-donut').style.background=stops.length?'conic-gradient('+stops.join(',')+')':'#39594d';$('allocation-center').textContent=model.pricedCount+'/'+model.rows.length;
  $('positions').replaceChildren();const unknown=$('unknown-positions');unknown.replaceChildren();
  for(const row of [...model.rows].sort((a,b)=>{const rank={balance:0,stake:1,unbonding:2,rewards:3,other:4};return rank[a.kind]-rank[b.kind];})){(row.valueCents===null?unknown:$('positions')).append(position(row));}
  if(!$('positions').children.length)$('positions').append(node('p','positions-empty','Noch keine Position mit gebundenem Referenzkurs.'));
  $('unknown-assets').hidden=!model.unpriced.length;$('unknown-count').textContent=String(model.unpriced.length);
  $('holdings-count').textContent=model.rows.length+' Positionen · '+current.chain.name;
  current.receipt.valuation={schema:'HALVETH_PORTFOLIO_REFERENCE_V1',computedAt:new Date().toISOString(),currency,knownValueCents:model.total.toString(),pricedPositions:model.pricedCount,unpricedPositions:model.unpriced.length,metadataRevision:valuation.registryRevision,quoteFetchedAt:valuation.fetchedAt,scope:'SELECTED_NETWORK_OBSERVED_POSITIONS_REFERENCE_PRICES',rows:model.rows.map(r=>({kind:r.kind,denom:r.base,amount:r.raw,decimals:r.meta.decimals??null,priceId:r.meta.coingeckoId||null,price:Number.isFinite(r.price)?r.price:null,priceAt:r.priceAt||null,valueCents:r.valueCents?.toString()??null}))};
}
export async function refreshPortfolioPrices(){
  if(refreshing)return;refreshing=true;$('refresh-valuation').disabled=true;
  try{
    const ids=current?[...new Set(buildPortfolio(current.data,current.chain,valuation,currency).rows.map(r=>r.meta.coingeckoId).filter(Boolean))]:[...new Set(Object.keys(valuation.prices||{}))];
    if(!ids.length)throw Error('Noch keine Kurs-IDs zugeordnet');
    const response=await fetch('https://api.coingecko.com/api/v3/simple/price?'+new URLSearchParams({ids:ids.join(','),vs_currencies:'eur,usd',include_last_updated_at:'true'}),{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Kursdienst: HTTP '+response.status);const prices=await response.json();
    if(!ids.some(id=>Number.isFinite(prices[id]?.eur)&&Number.isFinite(prices[id]?.usd)))throw Error('Keine nutzbaren Kurse empfangen');
    for(const id of ids)if(prices[id])valuation.prices[id]=prices[id];valuation.fetchedAt=new Date().toISOString();render();
  }catch{render();$('valuation-time').textContent=quoteStatus()+' · Aktualisierung gerade nicht verfügbar';}
  finally{refreshing=false;$('refresh-valuation').disabled=false;}
}
export async function loadValidatorNames(data){
  const validators=[...new Set((data.delegations||[]).map(d=>d.delegation.validator_address))].slice(0,15);
  await Promise.allSettled(validators.map(async address=>{const response=await fetch(data.endpoint+'/cosmos/staking/v1beta1/validators/'+encodeURIComponent(address),{signal:AbortSignal.timeout(7000)});if(!response.ok)return;const result=await response.json(),name=result.validator?.description?.moniker;if(typeof name==='string'&&name.length<=200)validatorNames.set(address,name);}));
  if(current?.data===data)render();
}
export function wirePortfolio(){for(const button of document.querySelectorAll('[data-currency]'))button.onclick=()=>{currency=button.dataset.currency;render();};$('refresh-valuation').onclick=refreshPortfolioPrices;}
