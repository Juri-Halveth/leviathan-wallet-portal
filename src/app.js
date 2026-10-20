import { CosmWasmClient, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { GasPrice, calculateFee } from '@cosmjs/stargate';
import { toUtf8 } from '@cosmjs/encoding';
import { CHAIN, address, rawAmount, orai, message, endpoint, assertFresh } from './core.js';
import {startClock} from './time.js';
import {readRest,readBalance} from './rest.js';
import {getCosmosPlugin} from './wallet-plugins.js';
import {getOWallet} from './wallet-provider.js';
import {readDelegationMaximum} from './staking-read.js';
const $=id=>document.getElementById(id);
const requestedWallet=new URLSearchParams(location.hash.slice(1)).get('wallet');
const walletPluginId=['owallet','keplr','leap'].includes(requestedWallet)?requestedWallet:'owallet';
const walletLabel={owallet:'OWallet',keplr:'Keplr',leap:'Leap'}[walletPluginId];
let wallet=null, sender='', signer=null, mode='contract', execute=false, prepared=null, latest=null, pending=false, delegations=[], accountRead=null, expiryTimer=null, walletEpoch=0;
const formIds=['contract','message','funds','validator','destination','amount','gasprice','memo','rpc','rest'];
function snapshot(){return JSON.stringify({mode,execute,sender,values:formIds.map(id=>$(id).value)});}
function invalidate(){prepared=null;clearTimeout(expiryTimer);$('sign').disabled=true;$('review').hidden=true;}
function status(text,error=false){$('status').classList.toggle('error',error);$('status').replaceChildren();const dot=document.createElement('span');dot.className='status-dot';$('status').append(dot,document.createTextNode(text));}
function output(value){latest=value;$('result').textContent=JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2);$('export').disabled=false;}
function step(n){[1,2,3].forEach(i=>$('step'+i).classList.toggle('current',i===n));}
async function task(fn){if(pending)return;pending=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){if($('readstatus').textContent==='Lade …')$('readstatus').textContent='Datenabruf fehlgeschlagen';status(e.message||String(e),true);output({error:e.message||String(e),time:new Date().toISOString()});}finally{pending=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);$('sign').disabled=!prepared;$('export').disabled=!latest;}}
async function refresh(){
  const a=address($('watch').value),base=endpoint($('rest').value);$('readstatus').textContent='Lade …';$('balance').textContent='—';$('stake').textContent='—';$('unbonding').textContent='—';$('balance-label').textContent='Verfügbar';$('read-warning').textContent='';$('unbonding-hint').textContent='Entbindungsfrist noch nicht gelesen. Entstaken zahlt nicht sofort aus.';delegations=[];accountRead=null;
  const node=await readRest(base,'/cosmos/base/tendermint/v1beta1/blocks/latest');
  if((node.block?.header||node.sdk_block?.header)?.chain_id!==CHAIN)throw new Error('Der REST-Endpunkt konnte nicht als Oraichain bestätigt werden. Verbindung & technische Details prüfen.');
  const results=await Promise.allSettled([
    readBalance(base,a),
    readRest(base,'/cosmos/staking/v1beta1/delegations/'+a+'?pagination.limit=1000'),
    readRest(base,'/cosmos/staking/v1beta1/delegators/'+a+'/unbonding_delegations?pagination.limit=1000'),
    readRest(base,'/cosmos/staking/v1beta1/params')
  ]);
  if($('watch').value!==a||endpoint($('rest').value)!==base)throw new Error('Adresse oder Datenquelle während der Abfrage geändert. Bitte aktualisieren.');
  const warnings=[];
  const keys=['balances','delegation_responses','unbonding_responses'];
  results.forEach((r,i)=>{if(r.status==='fulfilled'&&((i<3&&!Array.isArray(r.value[keys[i]]))||(i===3&&!/^\d+(\.\d+)?s$/.test(r.value.params?.unbonding_time||''))))results[i]={status:'rejected',reason:new Error('Unerwartetes Antwortformat für '+['Guthaben','Staking','Freigaben','Entbindungsfrist'][i])};});
  const val=i=>results[i].status==='fulfilled'?results[i].value:null;
  const balance=val(0),del=val(1),unbond=val(2),params=val(3);
  if(balance){$('balance').textContent=orai(balance.balances.find(c=>c.denom==='orai')?.amount||'0')+' ORAI';if(balance.kind==='BANK_TOTAL')$('balance-label').textContent='Bankguthaben';if(balance.warning)warnings.push(balance.warning);}
  if(del){delegations=del.delegation_responses||[];accountRead=a;$('stake').textContent=orai(delegations.reduce((s,d)=>s+BigInt(d.balance.denom==='orai'?d.balance.amount:'0'),0n))+' ORAI';}
  if(unbond)$('unbonding').textContent=orai((unbond.unbonding_responses||[]).flatMap(d=>d.entries||[]).reduce((s,e)=>s+BigInt(e.balance),0n))+' ORAI';
  if(params){const days=Number.parseFloat(params.params.unbonding_time)/86400;$('unbonding-hint').textContent='Aktuelle Entbindungsfrist: '+days.toLocaleString('de-DE')+' Tage. Entstaken startet diese Frist; die Auszahlung erfolgt nicht sofort.';}
  const failures=results.filter(r=>r.status==='rejected');
  for(const r of results)if(r.status==='fulfilled'&&r.value.pagination?.next_key)warnings.push('Seitenlimit erreicht; angezeigte Summe ist ein Teilbetrag.');
  warnings.push(...failures.map(r=>r.reason.message));$('read-warning').textContent=warnings.join(' ');
  $('readstatus').textContent=(warnings.length?'Teilweise geladen · ':'')+new Date().toLocaleTimeString('de-DE');
  if(failures.length===results.length)throw new Error('Kontodaten derzeit nicht erreichbar. Die Wallet-Freigabe bleibt davon getrennt. '+warnings.join(' '));
  status((sender?`${walletLabel} verbunden. `:'Lesemodus. ')+(warnings.length?'Kontodaten teilweise geladen; Hinweise unter den Beträgen beachten.':'Aktuelle Kontodaten von Oraichain geladen.'));
  return {partial:warnings.length>0};
}
async function connect(){
  invalidate();const epoch=++walletEpoch;wallet=null;sender='';signer=null;accountRead=null;$('connection').textContent=`${walletLabel}-Freigabe ausstehend`;$('connect').textContent=`${walletLabel} verbinden ↗`;status(`${walletLabel}-Verbindung anfragen …`);
  try{
  const provider=walletPluginId==='owallet'?await getOWallet():getCosmosPlugin(walletPluginId).provider;await provider.enable(CHAIN);
  const key=await provider.getKey(CHAIN);address(key.bech32Address);let candidateSigner;
  if(typeof provider.getOfflineSignerAuto==='function')candidateSigner=await provider.getOfflineSignerAuto(CHAIN);
  else if(typeof provider.getOfflineSigner==='function')candidateSigner=provider.getOfflineSigner(CHAIN);
  else throw new Error(`Diese ${walletLabel}-Version stellt keinen Cosmos-Signer bereit.`);
  const accounts=await candidateSigner.getAccounts(),current=await provider.getKey(CHAIN);if(epoch!==walletEpoch||current.bech32Address!==key.bech32Address||!accounts.some(a=>a.address===key.bech32Address))throw new Error('Wallet-Konto während der Verbindung geändert. Bitte erneut verbinden.');
  wallet=provider;signer=candidateSigner;sender=key.bech32Address;$('watch').value=sender;$('connection').textContent=`${walletLabel} verbunden · `+sender.slice(0,12)+'…'+sender.slice(-6);$('connect').textContent=`${walletLabel} wechseln ↗`;
  }catch(e){$('connection').textContent=`${walletLabel} nicht verbunden`;throw e;}
  try{await refresh();}catch(e){if(epoch!==walletEpoch)return;status(`${walletLabel} verbunden. Kontodaten konnten nicht geladen werden: `+e.message,true);$('readstatus').textContent='Datenabruf fehlgeschlagen';$('read-warning').textContent=e.message;}
}
async function client(signing=false){
  const url=endpoint($('rpc').value);
  const c=signing?await SigningCosmWasmClient.connectWithSigner(url,signer):await CosmWasmClient.connect(url);
  try{if(await c.getChainId()!==CHAIN)throw new Error('Der RPC-Endpunkt meldet eine andere Chain. Erwartet: Oraichain.');return c;}catch(e){c.disconnect();throw e;}
}
function render(){invalidate();$('contract-fields').hidden=mode!=='contract';$('staking-fields').hidden=mode==='contract';$('unstake-fields').hidden=!['unstake','delegate','redelegate'].includes(mode);$('rewards-hint').hidden=mode!=='rewards';$('destination-wrap').hidden=mode!=='redelegate';$('max').hidden=mode==='delegate';$('unbonding-hint').hidden=mode!=='unstake';$('validator-label').textContent=mode==='delegate'?'Bei diesem Validator anlegen':mode==='redelegate'?'Bisheriger Validator':'Validator-Operator';$('staking-note').textContent=mode==='delegate'?'Legt den gewählten Betrag aus deinem verfügbaren Guthaben im Staking an. Netzwerkgebühren kommen hinzu.':mode==='redelegate'?'Verschiebt deine Delegation zum neuen Validator. Bestehende Redelegationsfristen können einen Wechsel verhindern.':'';const tx=mode!=='contract'||execute;$('tx-options').hidden=!tx;$('funds-wrap').hidden=!execute;$('sign').hidden=!tx;$('run').textContent=tx?'Transaktion simulieren →':'Abfrage ausführen →';$('action-note').textContent=tx?`Die Simulation sendet keine Transaktion. Erst die anschließende Signatur in ${walletLabel} kann Funds bewegen.`:'Leseabfragen brauchen keine Signatur und bewegen keine Funds.';step(1);document.querySelectorAll('.tab').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-selected',String(b.dataset.mode===mode));});$('query-mode').classList.toggle('selected',!execute);$('execute-mode').classList.toggle('selected',execute);}
function transaction(){
  if(!sender||!signer)throw new Error(`Zuerst ${walletLabel} verbinden.`);
  if(new TextEncoder().encode($('memo').value).length>256)throw new Error('Memo ist länger als 256 UTF-8-Bytes.');
  if(mode==='contract'){
    const target=address($('contract').value),msg=message($('message').value),raw=rawAmount($('funds').value);
    return {typeUrl:'/cosmwasm.wasm.v1.MsgExecuteContract',value:{sender,contract:target,msg:toUtf8(JSON.stringify(msg)),funds:raw==='0'?[]:[{denom:'orai',amount:raw}]}};
  }
  const validator=address($('validator').value,'oraivaloper');
  if(['unstake','delegate','redelegate'].includes(mode)){
    const raw=rawAmount($('amount').value);if(raw==='0')throw new Error('Der Entstake-Betrag muss größer als null sein.');
    const amount={denom:'orai',amount:raw};
    if(mode==='redelegate'){const dest=address($('destination').value,'oraivaloper');if(dest===validator)throw new Error('Bisheriger und neuer Validator sind identisch.');return {typeUrl:'/cosmos.staking.v1beta1.MsgBeginRedelegate',value:{delegatorAddress:sender,validatorSrcAddress:validator,validatorDstAddress:dest,amount}};}
    return {typeUrl:mode==='delegate'?'/cosmos.staking.v1beta1.MsgDelegate':'/cosmos.staking.v1beta1.MsgUndelegate',value:{delegatorAddress:sender,validatorAddress:validator,amount}};
  }
  return {typeUrl:'/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',value:{delegatorAddress:sender,validatorAddress:validator}};
}
async function run(){
  invalidate();$('txlink').hidden=true;
  if(mode==='contract'&&!execute){const target=address($('contract').value),msg=message($('message').value);status('Lese Contract-Zustand …');const c=await client();try{output(await c.queryContractSmart(target,msg));status('Leseabfrage erfolgreich · keine Transaktion gesendet.');}finally{c.disconnect();}return;}
  const msg=transaction(),memo=$('memo').value,snap=snapshot(),priceText=$('gasprice').value.trim();
  if(!/^(0|[1-9]\d*)(\.\d{1,9})?$/.test(priceText)||Number(priceText)<=0)throw new Error('Einen positiven Gaspreis mit Dezimalpunkt eingeben.');
  const gasPrice=GasPrice.fromString(priceText+'orai');step(2);status('Simuliere den tatsächlichen Aufruf auf Oraichain …');
  const c=await client(true);
  try{
    const gas=await c.simulate(sender,[msg],memo);
    if(!Number.isSafeInteger(gas)||gas<=0)throw new Error('Ungültige Gas-Schätzung erhalten.');
    const fee=calculateFee(Math.ceil(gas*1.4),gasPrice);
    if(snapshot()!==snap)throw new Error('Eingaben während der Simulation geändert. Erneut simulieren.');
    prepared={snapshot:snap,sender,time:Date.now(),monotonicTime:performance.now(),msg,memo,fee};
    const labels={delegate:'Im Staking anlegen',unstake:'Staking freigeben',redelegate:'Validator wechseln',rewards:'Erträge abholen',contract:'Contract Execute'};
    const funds=mode==='contract'?orai(rawAmount($('funds').value))+' ORAI an den Contract':mode==='rewards'?'Vorhandene Rewards anfordern':$('amount').value+' ORAI';
    $('review').textContent='Aktion: '+labels[mode]+'\nWallet: '+sender+'\nZiel: '+(mode==='contract'?$('contract').value:$('validator').value)+(mode==='redelegate'?'\nNeuer Validator: '+$('destination').value:'')+'\nBetrag: '+funds+'\nGeschätzte Netzwerkgebühr: '+orai(fee.amount[0].amount)+' ORAI\nGaslimit inkl. 40 % Puffer: '+fee.gas+'\nSimulation gültig für 60 Sekunden.';
    $('review').hidden=false;output({simulation:'erfolgreich',chainId:CHAIN,gasUsed:gas,fee,message:msg,memo,simulatedAt:new Date().toISOString(),broadcast:false});status(`Simulation erfolgreich. Der nächste Schritt öffnet ${walletLabel} zur Prüfung und Signatur.`);
    expiryTimer=setTimeout(()=>{invalidate();status('Simulation abgelaufen. Vor einer Signatur erneut simulieren.');},60000);
  }finally{c.disconnect();}
}
async function sign(){
  assertFresh(prepared,snapshot(),sender);const p=prepared;invalidate();
  const key=await wallet.getKey(CHAIN);if(key.bech32Address!==p.sender)throw new Error('Wallet-Konto hat sich geändert. Neu verbinden und simulieren.');
  const accounts=await signer.getAccounts();if(!accounts.some(a=>a.address===p.sender))throw new Error('Signer-Konto hat sich geändert.');
  assertFresh(p,snapshot(),sender);
  const c=await client(true);
  try{
    assertFresh(p,snapshot(),sender);step(3);status(`Prüfe und bestätige die Transaktion in ${walletLabel}.`);
    const result=await c.signAndBroadcast(p.sender,[p.msg],p.fee,p.memo);
    output(result);$('txlink').href='https://scan.orai.io/txs/'+encodeURIComponent(result.transactionHash);$('txlink').hidden=false;
    if(result.code!==0){status('Transaktion im Block fehlgeschlagen, Code '+result.code+'. Netzwerkgebühren können trotzdem angefallen sein.',true);return;}
    status('Transaktion bestätigt · Höhe '+result.height+'.');
    try{const read=await refresh();status('Transaktion bestätigt · Höhe '+result.height+(read.partial?'. Kontodaten teilweise aktualisiert.':'. Wallet-Daten aktualisiert.'));}catch(e){status('Transaktion bestätigt; Aktualisierung der Wallet-Daten fehlgeschlagen: '+e.message,true);}
  }catch(e){throw new Error('Keine erfolgreiche Bestätigung erhalten: '+e.message+'. Bei unklarem Broadcast-Status vor erneutem Senden im Explorer prüfen.');}
  finally{c.disconnect();}
}
$('connect').onclick=()=>task(connect);$('refresh').onclick=()=>task(refresh);$('run').onclick=()=>task(run);$('sign').onclick=()=>task(sign);
$('inspect').onclick=()=>task(async()=>{invalidate();const a=address($('contract').value);status('Prüfe Contract-Metadaten …');const c=await client();try{output(await c.getContract(a));status('CosmWasm-Contract gefunden. Nachrichten benötigen weiterhin dessen Schnittstelle.');}finally{c.disconnect();}});
$('max').onclick=()=>task(async()=>{
  invalidate();$('amount').value='';
  const connected=sender,epoch=walletEpoch;
  const readMaxAddress=(value,prefix,label)=>{
    if(!value.trim())throw new Error('MAX: '+label+' fehlt. '+(prefix==='oraivaloper'?'Validator-Adresse mit oraivaloper1 eintragen.':`${walletLabel} verbinden oder deine Wallet-Adresse mit orai1 eintragen.`));
    try{return address(value,prefix);}catch{throw new Error('MAX: '+label+' ist ungültig. Erwartet wird eine vollständige '+prefix+'1-Adresse mit gültiger Prüfsumme. Ein Memo gehört ins Feld Memo.');}
  };
  const a=readMaxAddress(connected||$('watch').value,'orai','Wallet-Adresse'),v=readMaxAddress($('validator').value,'oraivaloper','Validator-Adresse'),base=endpoint($('rest').value);
  if(connected&&$('watch').value!==connected){$('watch').value=connected;accountRead=null;}
  $('max').textContent='Lade …';status('Lese aktuellen Staking-Betrag für diesen Validator …');
  try{
    const result=await readDelegationMaximum(base,a,v);
    if(epoch!==walletEpoch||sender!==connected||$('watch').value!==a||$('validator').value!==v||endpoint($('rest').value)!==base)throw new Error('Konto, Validator oder Datenquelle während MAX geändert. Bitte erneut drücken.');
    $('amount').value=result.amount;
    output({operation:'MAX_DELEGATION_READ',...result,broadcast:false});
    status('MAX übernommen: '+result.amount+' ORAI bei diesem Validator.'+(connected?' Bereit zur Simulation.':` Lesemodus: Vor einer Transaktion ${walletLabel} verbinden.`));
  }finally{$('max').textContent='MAX';}
});
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;render();});
$('query-mode').onclick=()=>{execute=false;render();};$('execute-mode').onclick=()=>{execute=true;render();};
formIds.forEach(id=>$(id).addEventListener('input',()=>{invalidate();if(id==='rest')accountRead=null;step(1);}));$('watch').addEventListener('input',()=>{invalidate();accountRead=null;});
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(latest,(_,v)=>typeof v==='bigint'?v.toString():v,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='halveth-orai-result-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function accountChanged(){walletEpoch++;invalidate();wallet=null;sender='';signer=null;accountRead=null;$('connection').textContent='Wallet-Konto geändert · erneut verbinden';$('connect').textContent=`${walletLabel} verbinden ↗`;status('Wallet-Konto geändert. Bitte erneut verbinden.');}
window.addEventListener('keplr_keystorechange',accountChanged);window.addEventListener('owallet_keystorechange',accountChanged);
const route=new URLSearchParams(location.hash.slice(1));
if(['delegate','unstake','redelegate','rewards','contract'].includes(route.get('mode')))mode=route.get('mode');
try{if(route.get('validator'))$('validator').value=address(route.get('validator'),'oraivaloper');if(route.get('watch'))$('watch').value=address(route.get('watch'));}catch{status('Ungültige Adresse im Aufruflink.',true);}
if(route.get('amount')){try{rawAmount(route.get('amount'));$('amount').value=route.get('amount');}catch{status('Ungültiger Betrag im Aufruflink.',true);}}
if(route.get('focus')==='1'&&mode!=='contract'){
  document.body.classList.add('focused-action');
  document.querySelector('h1').textContent={unstake:'Staking freigeben.',delegate:'ORAI anlegen.',rewards:'Erträge abholen.',redelegate:'Validator wechseln.'}[mode];
  const resultDetails=document.createElement('details'),summary=document.createElement('summary');
  summary.textContent='Technische Antwort';resultDetails.className='focused-result';$('result').before(resultDetails);resultDetails.append(summary,$('result'));
}
startClock(document.getElementById('live-clock'));
render();
if($('watch').value.trim())task(refresh);
else status(`Öffentliche Adresse eingeben oder ${walletLabel} verbinden, um deine Daten zu lesen.`);

$('sign').textContent='In '+walletLabel+' prüfen & signieren ↗';
$('connect').textContent=walletLabel+' verbinden ↗';
if(walletPluginId==='leap')window.addEventListener('leap_keystorechange',accountChanged);
