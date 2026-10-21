import {createWalletPlugins} from './wallet-plugins.js';
import {evmChains,evmAddress,walletRpc} from './evm-read.js';
import {discoverEvmNetworks} from './evm-discovery.js';
import {jsonFetch,readCosmos,validateWatch,actionLink,formatUnits} from './discovery.js';
import {buildPortfolio,money,shortId,groups} from './portfolio.js';
import {mountWalletActions} from './wallet-actions.js';
import {walletActionsDialog} from './wallet-actions-view.js';

const e=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const labels=Object.fromEntries(groups);
const positive=row=>/\d*[1-9]/.test(row.raw);

export function mountLuminousWallet(){
  const root=document.getElementById('luminous-root');
  if(!root)return;
  let chains=[],valuation={metadata:{},prices:{}},observations=new Map(),states=new Map(),keys=new Map();
  let activePlugin=null,evmListenerCleanup=()=>{},walletPlugins;
  let provider=null,epoch=0,busy=false,hideDust=true,selected=null,currency='usd',timer=null,lastRead=null;
  let vaultRows=[],names=new Map();
  try{hideDust=localStorage.getItem('halveth:luminous:hideDust')!=='no';}catch{}
  root.innerHTML=`
  <div class="lw-atmosphere" aria-hidden="true"></div>
  <header class="lw-header"><a class="lw-brand" href="#vault"><span class="lw-brand-symbol">✦</span> HALVETH <small>LEVIATHAN / LUCINET</small></a><div class="lw-header-right"><span class="lw-local"><i></i> BROWSER VAULT</span></div></header>
  <main class="lw-main" id="vault">
    <div class="lw-titlebar"><span class="lw-kicker">DEIN VERMÖGEN · EIN SIGNAL</span><span id="lw-clock" class="lw-kicker"></span></div>
    <section class="lw-stage" aria-label="Wallet-Übersicht">
      <div class="lw-intro"><p class="lw-kicker">LUCINET / WALLET INTELLIGENCE</p><h1>Deine Wallet.<br><em>Dein Überblick.</em></h1><p class="lw-lead" id="lw-lead">Deine Wallet ist der Schlüssel.<br>Wir finden, wo dein Vermögen liegt.</p><button id="lw-connect" class="lw-connect" disabled><span>Wallet verbinden</span><b>↗</b></button><p class="lw-micro" id="lw-account">Wallet frei wählen · Cosmos & Ethereum / EVM</p><p class="lw-micro"><button id="lw-open-actions" class="lw-inline-link" type="button">ETH &amp; GTC senden oder empfangen ↗</button></p><details class="lw-watch" id="lw-watch"><summary>Öffentliche Adresse ansehen</summary><form id="lw-watch-form"><label for="lw-network">Netzwerk</label><select id="lw-network"></select><label for="lw-address">Öffentliche Adresse</label><input id="lw-address" autocomplete="off" spellcheck="false" placeholder="orai1…"><button type="submit">Positionen finden ↗</button></form></details></div>
      <div class="lw-cosmos" aria-label="Visuelle Verteilung deiner Positionen"><div class="lw-grid" aria-hidden="true"></div><div class="lw-orbit lw-orbit-one" aria-hidden="true"></div><div class="lw-orbit lw-orbit-two" aria-hidden="true"></div><div class="lw-orbit lw-orbit-three" aria-hidden="true"></div><svg class="lw-rays" viewBox="0 0 600 500" aria-hidden="true"><path d="M300 250L140 110M300 250L475 150M300 250L450 385M300 250L125 370"/></svg><div class="lw-core"><span id="lw-total-label">DEIN VERMÖGEN</span><strong id="lw-total">—</strong><small id="lw-total-scope">Wartet auf Adresse</small></div><div id="lw-satellites"></div><span class="lw-coordinate">LUCINET • POSITION FIELD / 01</span></div>
    </section>
    <div class="lw-statusbar"><div><span class="lw-status-dot"></span><span id="lw-status" role="status" aria-live="polite">Bereit für deine Wallet.</span></div><button id="lw-refresh" class="lw-icon" aria-label="Positionen aktualisieren" title="Positionen aktualisieren" hidden>↻</button></div>
    <section class="lw-holdings" aria-label="Gefundene Positionen"><div class="lw-section-head"><div><p class="lw-kicker">DEINE KOORDINATEN</p><h2>Hier liegt dein Vermögen.</h2></div><div class="lw-controls"><label class="lw-dust"><input type="checkbox" id="lw-dust" checked><span>Unter 2 US$ ausblenden</span></label><div class="lw-currency"><button id="lw-usd" aria-pressed="true">$</button><button id="lw-eur" aria-pressed="false">€</button></div></div></div><div id="lw-network-strip" class="lw-network-strip"></div><div id="lw-cards" class="lw-cards"><div class="lw-empty"><span>✧</span><p>Wallet verbinden oder öffentliche Adresse ansehen.<br>Gefundene Positionen erscheinen hier.</p></div></div><p class="lw-micro" id="lw-hidden-count"></p></section>
    <footer class="lw-footer"><span>HALVETH / VERACHEL STUDIOS</span><details><summary>Quellen & Abdeckung</summary><div id="lw-coverage">Bankguthaben, natives Staking, Freigaben und Erträge der angebundenen Cosmos-Netzwerke. EVM: automatische Suche auf Ethereum, Optimism, Base, Arbitrum, BNB Chain, Polygon und Avalanche. Native Coins, ERC-20-Kandidaten und angebundene Pool-Positionen; weitere Protokolle und Bitcoin bleiben offen. Öffentliche Adressen werden an konfigurierte PublicNode-RPCs und auf drei Netzwerken an Blockscout übermittelt. Die Wallet gibt jedes Netzwerk selbst frei. Unbekannte Kurse bleiben sichtbar.</div><div id="lw-scan-coverage"></div><p id="lw-quotes"></p><button id="lw-enable-networks" class="lw-action" hidden>Weitere Netzwerke freigeben</button></details><span class="lw-footer-signal"><a href="https://github.com/Juri-Halveth/leviathan-wallet-portal" target="_blank" rel="noopener noreferrer">CODE &amp; RECHTE ↗</a> · ✦ DEINE WALLET. DEIN SIGNAL.</span></footer>
  </main>
  <dialog id="lw-wallet-picker" class="lw-dialog lw-picker" aria-label="Wallet auswählen"><button id="lw-picker-close" class="lw-close" aria-label="Wallet-Auswahl schließen">×</button><p class="lw-kicker">DEINE VERBINDUNG</p><h2>Wähle deine Wallet.</h2><p class="lw-micro">Verbinde die Erweiterung oder den integrierten Wallet-Browser deiner Wahl.</p><div id="lw-wallet-options" class="lw-wallet-options"></div><button id="lw-picker-watch" class="lw-picker-watch" type="button">Ohne Wallet: öffentliche Adresse ansehen ↗</button><p class="lw-micro lw-picker-note">Erkannt bedeutet: Eine Schnittstelle ist in diesem Browser vorhanden. Die Wallet bestätigt den Zugriff selbst. Mobile QR-Verbindung ist noch nicht angebunden.</p><button id="lw-wallet-rescan" class="lw-action">Wallets erneut erkennen ↻</button></dialog>
  <dialog id="lw-detail" class="lw-dialog" aria-label="Details zur Position"><button id="lw-close" class="lw-close" aria-label="Details schließen">×</button><div id="lw-detail-body"></div></dialog>
  ${walletActionsDialog}`;
  const $=id=>document.getElementById(id);
  const walletActions=mountWalletActions();
  function openWalletActions(){if(!$('lw-evm-actions').open)$('lw-evm-actions').showModal();}
  $('lw-evm-close').onclick=()=>$('lw-evm-actions').close();
  $('lw-evm-actions').onclick=event=>{if(event.target===$('lw-evm-actions'))$('lw-evm-actions').close();};
  $('lw-open-actions').onclick=openWalletActions;
  if(location.hash==='#wallet-actions')openWalletActions();
  window.addEventListener('hashchange',()=>{if(location.hash==='#wallet-actions')openWalletActions();});
  $('lw-dust').checked=hideDust;
  const status=text=>{$('lw-status').textContent=text;};
  const allCosmos=()=>chains.filter(c=>c.kind==='cosmos');
  const activeChains=()=>activePlugin?.kind==='evm'?evmChains:allCosmos();
  const withWallet=url=>url+'&wallet='+encodeURIComponent(activePlugin?.kind==='cosmos'?activePlugin.id:'owallet');
  function setBusy(value){busy=value;$('lw-connect').disabled=value||!chains.length;$('lw-refresh').disabled=value;if($('lw-change-wallet'))$('lw-change-wallet').disabled=value;$('lw-watch-form').querySelector('button').disabled=value;$('lw-enable-networks').disabled=value;root.classList.toggle('lw-scanning',value);}
  function reset(){$('lw-enable-networks').hidden=true;observations.clear();states.clear();keys.clear();names.clear();selected=null;lastRead=null;$('lw-detail').close();render();}
  function models(){return [...observations.values()].map(({data,chain})=>({data,chain,model:buildPortfolio(data,chain,valuation,currency)}));}
  function render(){
    const ms=models();vaultRows=ms.flatMap(x=>x.model.rows.filter(positive).map(row=>({...row,chain:x.chain,data:x.data,key:x.chain.id+':'+row.id})));
    const total=ms.reduce((sum,x)=>sum+x.model.total,0n),priced=ms.reduce((sum,x)=>sum+x.model.pricedCount,0),unknown=vaultRows.filter(r=>r.valueCents===null).length;
    $('lw-total').textContent=ms.length?(priced?money(total,currency):'Kurs offen'):'—';
    $('lw-total-label').textContent=unknown||ms.some(x=>x.model.missing.length)||[...states.values()].some(s=>['error','denied'].includes(s))?'BEKANNTER TEILWERT':'ERFASSTER WERT';
    $('lw-total-scope').textContent=ms.length?ms.length+' '+(ms.length===1?'Netzwerk':'Netzwerke')+' · '+unknown+' Kurse offen':'Wartet auf Adresse';
    $('lw-satellites').replaceChildren();
    for(const [i,kind]of ['balance','stake','unbonding','other'].entries()){
      const rows=vaultRows.filter(r=>r.kind===kind||(kind==='other'&&['rewards','pool'].includes(r.kind))),value=rows.reduce((s,r)=>s+(r.valueCents??0n),0n);
      const satellite=e('div','lw-satellite lw-satellite-'+i);const parts=kind==='other'?['balances','rewards']:[{balance:'balances',stake:'delegations',unbonding:'unbondings'}[kind]];
      const missing=ms.some(x=>parts.some(part=>!Array.isArray(x.data[part])));
      satellite.append(e('span','',kind==='other'?'Token & Pools':labels[kind]),e('strong','',ms.length?(missing?'Teilabfrage offen':rows.some(r=>r.valueCents!==null)||!rows.length?money(value,currency):'Kurs offen'):'—'));
      $('lw-satellites').append(satellite);
    }
    const strip=$('lw-network-strip');strip.replaceChildren();
    for(const c of activeChains()){
      const state=states.get(c.id)||'idle',chip=e('span','lw-chain '+state);chip.append(e('i'),document.createTextNode(c.name+(['error','denied'].includes(state)?' · offen':''))); chip.title={idle:'Noch nicht abgefragt',reading:'Wird gelesen',ok:'Abgefragte Kontoschnittstellen gelesen',partial:'Einzelne Kontoschnittstellen fehlen',error:'Nicht erfasst',denied:'Wallet-Adresse nicht freigegeben'}[state];chip.setAttribute('aria-label',c.name+': '+chip.title);strip.append(chip);
    }
    // The threshold always uses USD, independently of the display currency.
    const usd=new Map([...observations.values()].flatMap(({data,chain})=>buildPortfolio(data,chain,valuation,'usd').rows.map(r=>[chain.id+':'+r.id,r.valueCents])));
    let hidden=0;const shown=vaultRows.filter(r=>{const amount=usd.get(r.key);if(hideDust&&amount!==null&&amount!==undefined&&amount<200n){hidden++;return false;}return true;});
    shown.sort((a,b)=>{if(a.valueCents===null)return b.valueCents===null?a.key.localeCompare(b.key):1;if(b.valueCents===null)return -1;return a.valueCents===b.valueCents?a.key.localeCompare(b.key):a.valueCents>b.valueCents?-1:1;});
    const cards=$('lw-cards');cards.replaceChildren();
    const unknownGroup=e('details','lw-unknown-group'),unknownCards=e('div','lw-cards');unknownGroup.append(e('summary','',shown.filter(r=>r.valueCents===null&&r.kind!=='pool').length+' Token mit offenem Kurs'),unknownCards);
    for(const row of shown){
      const card=e('button','lw-card '+row.kind);card.type='button';
      const top=e('div','lw-card-top');top.append(e('span','lw-coin',row.meta.symbol?.slice(0,4)||'?'),e('span','lw-card-network',row.chain.name),e('span','lw-card-arrow','↗'));
      const title=row.kind==='pool'?(row.poolDetails?.positionId?row.meta.name:(row.protocol+' · '+(row.meta.symbol||'Token'))):row.kind==='stake'?(names.get(row.validator)||'Im Staking'):row.kind==='unbonding'?'Freigabe läuft':row.kind==='rewards'?'Erträge':row.meta.name||shortId(row.base,10);
      card.append(top,e('h3','',title),e('strong','lw-card-value',money(row.valueCents,currency)),e('p','lw-card-quantity',row.quantity+' '+(row.meta.symbol||'Basiseinheiten')));
      const foot=e('div','lw-card-bottom');foot.append(e('span','',labels[row.kind]||'Token'),e('span','',row.completionTime?'Bis '+new Date(row.completionTime).toLocaleDateString('de-DE'):row.valueCents===null?'Kurs offen':'Details öffnen'));card.append(foot);
      card.onclick=()=>openDetail(row.key);(row.valueCents===null&&row.kind!=='pool'?unknownCards:cards).append(card);
    }
    if(unknownCards.children.length)cards.append(unknownGroup);
    if(!shown.length){const empty=e('div','lw-empty');empty.append(e('span','','✧'),e('p','',!ms.length?'Wallet verbinden oder öffentliche Adresse ansehen. Gefundene Positionen erscheinen hier.':hidden?'Alle bewerteten Positionen liegen unter deinem Filter.':'Keine positiven Positionen in den gelesenen Schnittstellen.'));cards.append(empty);}
    $('lw-hidden-count').textContent=hidden?hidden+' kleine Positionen ausgeblendet · Der Gesamtwert enthält sie weiterhin.':'';
    $('lw-quotes').textContent=valuation.fetchedAt?'Referenzkurse: '+new Date(valuation.fetchedAt).toLocaleString('de-DE')+' · CoinGecko. Wallet-Adressen werden nicht an den Kursdienst gesendet.':'';
    if(lastRead)$('lw-account').textContent=activePlugin?.kind==='evm'?shortId([...keys.values()][0]||'',8)+' · '+activePlugin.name+' · '+observations.size+' Netzwerke':keys.size>1?keys.size+' Netzwerkadressen · '+activeChains().length+' angebundene Netzwerke':shortId([...keys.values()][0]||'',10)+' · '+(activePlugin?activePlugin.name:'Öffentliche Leseabfrage');
    const coverage=$('lw-scan-coverage');coverage.replaceChildren();
    for(const {chain,data}of observations.values())if(chain.kind==='evm'){
      const tokens=data.coverage?.erc20,pools=data.coverage?.pools;
      coverage.append(e('p','lw-micro',chain.name+': '+(typeof tokens==='object'?tokens.checked+'/'+tokens.candidateCount+' Token-Kandidaten gelesen':'Token-Suche läuft')+' · '+(typeof pools==='object'?pools.positionsObserved+' Pool-Treffer, '+pools.v3ManagersChecked+' v3-Manager geprüft':'Pool-Suche läuft')));
    }
    $('lw-refresh').hidden=!keys.size;$('lw-lead').textContent=ms.length?'Deine Positionen. Über Netzwerke verteilt. Hier verbunden.':'Deine Wallet ist der Schlüssel. Wir finden, wo dein Vermögen liegt.';
  }
  function openDetail(key){
    selected=key;const row=vaultRows.find(r=>r.key===key);if(!row)return;
    const body=$('lw-detail-body');body.replaceChildren();body.append(e('p','lw-kicker',row.chain.name+' / '+labels[row.kind]),e('h2','',row.meta.name||row.meta.symbol||'Token'),e('strong','lw-detail-value',money(row.valueCents,currency)),e('p','lw-detail-quantity',row.quantity+' '+(row.meta.symbol||'Basiseinheiten')));
    const info=e('dl','lw-detail-info');const add=(a,b)=>info.append(e('dt','',a),e('dd','',b));
    add('Ort',row.kind==='stake'?(names.get(row.validator)||'Validator'):labels[row.kind]);
    if(row.completionTime)add('Wieder verfügbar',new Date(row.completionTime).toLocaleString('de-DE'));
    if(row.protocol)add('Protokoll',row.protocol);
    if(row.poolDetails?.positionId)add('Positions-ID',row.poolDetails.positionId);
    add('Gelesen',new Date(row.data.completedAt||row.data.queriedAt).toLocaleString('de-DE'));
    body.append(info);
    const actions=e('div','lw-detail-actions');
    if(row.chain.write&&row.validator&&row.kind==='stake')for(const [mode,label]of [['unstake','Entstaken'],['delegate','Mehr anlegen'],['rewards','Erträge abholen'],['redelegate','Validator wechseln']]){
      const a=e('a','lw-action',label+' ↗');const url=new URL(actionLink(mode,row.validator,row.data.address),location.href);url.hash+='&focus=1';if(mode==='unstake')url.hash+='&amount='+encodeURIComponent(formatUnits(row.raw,row.chain.decimals));a.href=withWallet(url.href);actions.append(a);
    }
    if(row.chain.write&&row.kind==='balance'){
      const b=e('button','lw-action','Anlegen ↗');b.onclick=()=>validatorPicker(row,actions);actions.append(b);
    }
    if(row.kind==='unbonding')body.append(e('p','lw-detail-note','Die Freigabe läuft bereits. Nach Ende der Entbindung wird der Betrag regulär wieder verfügbar.'));
    if(!row.chain.write)body.append(e('p','lw-detail-note',row.chain.kind==='evm'?'Token und Pool-Leseansicht. Weitere Protokolle oder verwahrte Pool-Positionen benötigen eigene Adapter.':'Dieses Netzwerk ist hier als Leseadapter angebunden. Transaktionsaktionen folgen mit einem eigenen Chain-Adapter.'));
    body.append(actions);
    const details=e('details','lw-origin');details.append(e('summary','','Kennung & Quelle'),e('p','',row.base),e('p','',row.data.address));if(row.validator)details.append(e('p','',row.validator));if(row.poolAddress)details.append(e('p','','Pool / Position-Manager: '+row.poolAddress));if(row.poolDetails){const pre=e('pre','lw-pool-receipt',JSON.stringify(row.poolDetails,null,2));details.append(pre);}details.append(e('p','',row.data.endpoint));body.append(details);
    if(!$('lw-detail').open)$('lw-detail').showModal();
  }
  async function validatorPicker(row,actions){
    const pickedEpoch=epoch;actions.replaceChildren(e('p','lw-micro','Validatoren werden geladen …'));
    try{
      const data=await jsonFetch(row.data.endpoint+'/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=200');
      if(epoch!==pickedEpoch||selected!==row.key)return;
      if(!Array.isArray(data.validators))throw Error('Validatorliste nicht lesbar');
      const select=e('select');select.setAttribute('aria-label','Validator zum Anlegen wählen');select.append(new Option('Validator auswählen',''));
      for(const v of data.validators){const address=validateWatch(v.operator_address,{...row.chain,prefix:'oraivaloper'});select.append(new Option(v.description?.moniker||shortId(address),address));}
      const a=e('a','lw-action','Weiter zur Vorbereitung ↗');a.hidden=true;select.onchange=()=>{a.hidden=!select.value;a.href=withWallet(actionLink('delegate',select.value,row.data.address)+'&focus=1');};actions.replaceChildren(select,a);
      if(data.pagination?.next_key)actions.append(e('p','lw-micro','Erste 200 Validatoren geladen.'));
    }catch{actions.replaceChildren(e('p','lw-detail-note','Validatorliste gerade nicht erreichbar. Bitte später erneut öffnen.'));}
  }
  async function readOne(c,address,run){
    states.set(c.id,'reading');render();let data,failed=[];
    // Sequential source fallback, no credential reuse and no access-control bypass.
    for(const base of c.rest.slice(0,2)){
      if(run!==epoch)return;
      try{data=await readCosmos(c,address,base);break;}catch(err){failed.push(String(err.message));if(/HTTP 40[13]/.test(err.message))break;}
    }
    if(run!==epoch)return;
    if(!data){states.set(c.id,'error');render();return;}
    observations.set(c.id,{chain:c,data});states.set(c.id,data.errors.length||data.partial.length?'partial':'ok');lastRead=new Date();render();
    const validators=[...new Set([...(data.delegations||[]).map(d=>d.delegation.validator_address),...(data.unbondings||[]).map(d=>d.validator_address)])].slice(0,15);
    await Promise.allSettled(validators.map(async v=>{try{const result=await jsonFetch(data.endpoint+'/cosmos/staking/v1beta1/validators/'+encodeURIComponent(v));if(run===epoch&&typeof result.validator?.description?.moniker==='string'){names.set(v,result.validator.description.moniker.slice(0,200));}}catch{}}));
    if(run===epoch)render();
  }
  async function scan(entries,run){
    let index=0;await Promise.all(Array.from({length:Math.min(3,entries.length)},async()=>{while(index<entries.length&&run===epoch){const [id,address]=entries[index++],c=chains.find(c=>c.id===id);await readOne(c,address,run);}}));
    if(run!==epoch)return;
    const ok=observations.size,missing=[...states.values()].filter(s=>s==='error'||s==='denied').length;
    status(ok?ok+' '+(ok===1?'Netzwerk gelesen':'Netzwerke gelesen')+(missing?' · '+missing+' nicht erfasst':'')+' · '+new Date().toLocaleTimeString('de-DE'):'Keine Kontodaten erreichbar. Bitte Verbindung und Quellen prüfen.');
    if(ok)void updateQuotes(run);
  }
  function detachEvm(){evmListenerCleanup();evmListenerCleanup=()=>{};}
  function scheduleRefresh(run){if(run===epoch&&keys.size)timer=setInterval(()=>{if(!document.hidden&&!busy&&!$('lw-detail').open&&!$('lw-wallet-picker').open)void refresh();},activePlugin?.kind==='evm'?180000:60000);}
  function walletOptions(){
    if(!walletPlugins)return;const box=$('lw-wallet-options');box.replaceChildren();
    const options=walletPlugins.list();
    for(const item of options){
      const b=e('button','lw-wallet-option'+(item.available?'':' unavailable'));b.type='button';b.disabled=!item.available;
      const icon=e('span','lw-wallet-icon',item.kind==='evm'?'◇':'✧'),text=e('span');text.append(e('strong','',item.name),e('small','',item.kind==='evm'?'Ethereum / EVM':'Cosmos'));
      b.append(icon,text,e('span','lw-wallet-detected',item.available?'Erkannt ↗':'Nicht erkannt'));b.onclick=()=>{if(busy)return;$('lw-wallet-picker').close();void connect(item.id);};box.append(b);
    }
    if(!provider&&!keys.size&&!busy)status(options.some(item=>item.available)?'Wallet erkannt. Wähle sie aus oder lies eine öffentliche Adresse.':'Keine Wallet in diesem Browser erkannt. Du kannst eine öffentliche Adresse ansehen.');
  }
  async function scanEvm(run,address){
    status('Suche auf '+evmChains.length+' EVM-Netzwerken · Token & Pools …');
    let quoteAt=0;
    await discoverEvmNetworks(provider,address,(chain,data)=>{
      if(run!==epoch)return;keys.set(chain.id,address);observations.set(chain.id,{chain,data});lastRead=new Date();render();
      if(Date.now()-quoteAt>10000){quoteAt=Date.now();void updateQuotes(run);}
    },(chain,state,error)=>{
      if(run!==epoch)return;states.set(chain.id,state);render();status('EVM-Suche · '+observations.size+'/'+evmChains.length+' Netzwerke gelesen · '+chain.name+(error?' nicht erreichbar':' wird zugeordnet'));
    },()=>run===epoch);
    if(run!==epoch)return;
    const tokens=[...observations.values()].reduce((n,x)=>n+x.data.balances.filter(b=>b.denom!==x.chain.denom&&BigInt(b.amount)>0n).length,0),positions=[...observations.values()].reduce((n,x)=>n+x.data.poolPositions.length,0);
    status(observations.size+'/'+evmChains.length+' Netzwerke gelesen · '+tokens+' Token-Bestände · '+positions+' Pool-Treffer · Weitere Protokolle offen');void updateQuotes(run);
  }
  async function connect(pluginId){
    if(busy)return;let choice;try{choice=walletPlugins.get(pluginId);}catch(err){status(err.message);return;}
    const run=++epoch;clearInterval(timer);detachEvm();walletActions.clearConnection('Wallet wird gewechselt.');reset();activePlugin=choice;provider=choice.provider;setBusy(true);render();
    status(choice.name+' in deiner Wallet freigeben.');
    try{
      if(choice.kind==='evm'){
        const accounts=await walletRpc(provider,'eth_requestAccounts');if(run!==epoch)return;
        if(!Array.isArray(accounts)||!accounts.length)throw Error('Die Wallet hat keine Adresse freigegeben.');
        walletActions.adoptConnection(provider,evmAddress(accounts[0]),choice.name);
        const changed=()=>{if(activePlugin?.id===choice.id)accountChanged();};
        if(typeof provider.on==='function'){for(const event of ['accountsChanged','chainChanged','disconnect'])provider.on(event,changed);const bound=provider;evmListenerCleanup=()=>{if(typeof bound.removeListener==='function')for(const event of ['accountsChanged','chainChanged','disconnect'])bound.removeListener(event,changed);};}
        await scanEvm(run,evmAddress(accounts[0]));
      }else{
        const primary=choice.id==='owallet'?'Oraichain':'cosmoshub-4';
        await provider.enable(primary);if(run!==epoch)return;
        await Promise.allSettled(allCosmos().map(async c=>{try{const key=await provider.getKey(c.chainId);if(run===epoch)keys.set(c.id,validateWatch(key.bech32Address,c));}catch{if(run===epoch)states.set(c.id,'denied');}}));
        if(run!==epoch)return;if(!keys.size)throw Error('Keine Netzwerkadresse freigegeben. Bitte Wallet und Netzwerk prüfen.');$('lw-enable-networks').hidden=false;await scan([...keys],run);
      }
      if(run===epoch){$('lw-connect').querySelector('span').textContent=choice.name+' verbunden';scheduleRefresh(run);}
    }catch(err){if(run===epoch){detachEvm();provider=null;walletActions.clearConnection('Wallet-Verbindung nicht freigegeben.');status(err.message||'Wallet-Verbindung nicht freigegeben.');$('lw-connect').querySelector('span').textContent='Wallet verbinden';}}
    finally{if(run===epoch)setBusy(false);}
  }
  async function refresh(){
    if(busy||!keys.size)return;const run=++epoch;setBusy(true);status('Positionen aktualisieren …');$('lw-detail').close();selected=null;
    // Never keep displaying stale holdings as a fresh read.
    observations.clear();states.clear();render();
    try{
      if(activePlugin?.kind==='evm'){await scanEvm(run,[...keys.values()][0]);return;}
      if(provider)for(const [id,old]of keys){const c=chains.find(c=>c.id===id),key=await provider.getKey(c.chainId);if(validateWatch(key.bech32Address,c)!==old)throw Error('Wallet-Konto geändert. Bitte neu verbinden.');}
      if(run===epoch)await scan([...keys],run);
    }catch(err){if(run===epoch){clearInterval(timer);reset();status(err.message);}}
    finally{if(run===epoch)setBusy(false);}
  }
  async function updateQuotes(run){
    const ids=[...new Set(models().flatMap(x=>x.model.rows.map(r=>r.meta.coingeckoId)).filter(Boolean))];if(!ids.length)return;
    try{const response=await jsonFetch('https://api.coingecko.com/api/v3/simple/price?'+new URLSearchParams({ids:ids.join(','),vs_currencies:'eur,usd',include_last_updated_at:'true'}));if(run!==epoch)return;let updated=false;for(const id of ids)if(Number.isFinite(response[id]?.usd)&&Number.isFinite(response[id]?.eur)){valuation.prices[id]=response[id];updated=true;}if(updated){valuation.fetchedAt=new Date().toISOString();render();}}catch{/* Dated reference quotes remain labelled. */}
  }
  $('lw-enable-networks').onclick=async()=>{
    if(busy||!provider||activePlugin?.kind!=='cosmos')return;const run=++epoch;clearInterval(timer);setBusy(true);
    try{const missing=allCosmos().filter(c=>!keys.has(c.id));if(!missing.length){status('Alle angebundenen Netzwerke sind bereits freigegeben.');return;}await provider.enable(missing.map(c=>c.chainId));if(run!==epoch)return;await Promise.allSettled(missing.map(async c=>{try{const k=await provider.getKey(c.chainId);if(run===epoch)keys.set(c.id,validateWatch(k.bech32Address,c));}catch{if(run===epoch)states.set(c.id,'denied');}}));if(run===epoch){observations.clear();states.clear();await scan([...keys],run);}}catch(err){if(run===epoch)status('Vorhandene Verbindung bleibt erhalten. Weitere Netzwerke: '+err.message);}finally{if(run===epoch){setBusy(false);if(keys.size)timer=setInterval(()=>{if(!document.hidden&&!busy)void refresh();},60000);}}
  };
  $('lw-connect').onclick=()=>{if(busy)return;walletPlugins.request();walletOptions();$('lw-wallet-picker').showModal();};
  $('lw-picker-close').onclick=()=>$('lw-wallet-picker').close();
  $('lw-picker-watch').onclick=()=>{$('lw-wallet-picker').close();$('lw-watch').open=true;$('lw-address').focus();};
  $('lw-wallet-rescan').onclick=()=>walletPlugins.request();
  walletPlugins=createWalletPlugins(walletOptions);
$('lw-refresh').onclick=refresh;
  $('lw-close').onclick=()=>{$('lw-detail').close();selected=null;};$('lw-detail').onclick=event=>{if(event.target===$('lw-detail')){$('lw-detail').close();selected=null;}};
  $('lw-dust').onchange=()=>{hideDust=$('lw-dust').checked;try{localStorage.setItem('halveth:luminous:hideDust',hideDust?'yes':'no');}catch{}render();};
  for(const cur of ['usd','eur'])$('lw-'+cur).onclick=()=>{currency=cur;for(const id of ['usd','eur'])$('lw-'+id).setAttribute('aria-pressed',String(id===cur));render();};
  $('lw-watch-form').onsubmit=async event=>{
    event.preventDefault();if(busy)return;const c=chains.find(c=>c.id===$('lw-network').value);let address;
    try{address=validateWatch($('lw-address').value,c);}catch(err){status(err.message);return;}
    const run=++epoch;clearInterval(timer);detachEvm();walletActions.clearConnection('Öffentliche Adresse wird gelesen.');activePlugin=null;provider=null;reset();keys.set(c.id,address);setBusy(true);status('Öffentliche Positionen lesen …');
    try{await scan([...keys],run);}finally{if(run===epoch)setBusy(false);}
  };
  function accountChanged(){epoch++;clearInterval(timer);detachEvm();walletActions.clearConnection('Wallet-Konto oder Netzwerk geändert.');provider=null;reset();setBusy(false);$('lw-connect').querySelector('span').textContent='Wallet neu verbinden';status('Wallet-Konto oder aktives Netzwerk geändert. Neu verbinden.');}
  window.addEventListener('keplr_keystorechange',()=>{if(activePlugin?.kind==='cosmos')accountChanged();});window.addEventListener('owallet_keystorechange',()=>{if(activePlugin?.kind==='cosmos')accountChanged();});window.addEventListener('leap_keystorechange',()=>{if(activePlugin?.id==='leap')accountChanged();});
  const clock=()=>{$('lw-clock').textContent=new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'})+' / BERLIN';};clock();setInterval(clock,30000);
  Promise.all([jsonFetch('data/chains.json'),jsonFetch('data/valuation.json')]).then(([registry,quotes])=>{chains=registry.chains;valuation=quotes;for(const c of allCosmos())$('lw-network').append(new Option(c.name,c.id));setBusy(false);render();}).catch(()=>status('Lokale Netzwerkliste nicht geladen. Bitte Seite neu öffnen.'));
}
