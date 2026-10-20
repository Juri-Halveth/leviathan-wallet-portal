// Provider discovery never authorizes accounts. Only the selected entry connects.
// Brand names/rdns are provider declarations, not extension authentication.
const cosmosSlots=[['owallet','OWallet','owallet'],['keplr','Keplr','keplr'],['leap','Leap','leap']];
const validCosmos=p=>p&&typeof p.enable==='function'&&typeof p.getKey==='function';
const validEvm=p=>p&&typeof p.request==='function';

export function getCosmosPlugin(id='owallet'){
  const slot=cosmosSlots.find(x=>x[0]===id);
  if(!slot||!validCosmos(window[slot[2]]))throw Error((slot?.[1]||'Diese Wallet')+' ist in diesem Browser nicht verfügbar. Öffne die Seite im Browser mit dieser Erweiterung.');
  return {id:slot[0],name:slot[1],kind:'cosmos',provider:window[slot[2]]};
}

export function createWalletPlugins(onChange){
  const announced=new Map();let closed=false;
  function remember(event){
    const info=event.detail?.info,p=event.detail?.provider;
    if(!validEvm(p)||typeof info?.uuid!=='string'||info.uuid.length>100||typeof info?.name!=='string')return;
    const id='evm:'+info.uuid;
    // An existing ID cannot replace its provider while a selection is bound.
    if(announced.has(id)||announced.size>=32)return;
    announced.set(id,{id,name:info.name.slice(0,70),kind:'evm',provider:p,rdns:typeof info.rdns==='string'?info.rdns.slice(0,200):'',discovery:'EIP6963'});
    if(!closed)onChange?.();
  }
  function list(){
    const entries=cosmosSlots.map(([id,name,slot])=>({id,name,kind:'cosmos',provider:validCosmos(window[slot])?window[slot]:null,available:validCosmos(window[slot]),discovery:'NAMED_SLOT'}));
    const evm=[...announced.values()];
    const add=(id,name,p)=>{if(validEvm(p)&&!evm.some(x=>x.provider===p))evm.push({id,name,kind:'evm',provider:p,discovery:'LEGACY_INJECTION'});};
    add('evm:trust-direct','Trust Wallet',window.trustwallet?.ethereum);
    // Read the provider array when a legacy extension exposes several providers.
    const injected=Array.isArray(window.ethereum?.providers)?window.ethereum.providers:[window.ethereum];
    injected.slice(0,20).forEach((p,i)=>add('evm:legacy-'+i,p?.isTrust?'Trust Wallet':p?.isMetaMask?'MetaMask':'Browser EVM Wallet',p));
    for(const item of evm)entries.push({...item,available:true});
    for(const [id,name,rdns]of [['evm:missing-metamask','MetaMask','io.metamask'],['evm:missing-trust','Trust Wallet','com.trustwallet.app']]){
      if(!evm.some(x=>x.rdns===rdns||x.name.toLowerCase().includes(name.toLowerCase())))entries.push({id,name,kind:'evm',available:false,provider:null});
    }
    return entries;
  }
  function request(){if(!closed){window.dispatchEvent(new Event('eip6963:requestProvider'));onChange?.();}}
  window.addEventListener('eip6963:announceProvider',remember);
  // Discovery is passive: no account, signature, permission or network request.
  queueMicrotask(request);
  window.addEventListener('load',request,{once:true});
  return {list,request,get(id){const item=list().find(x=>x.id===id);if(!item?.available)throw Error('Diese Wallet wurde hier nicht erkannt. Öffne die Seite im Browser mit der gewünschten Wallet-Erweiterung.');return item;},close(){closed=true;window.removeEventListener('eip6963:announceProvider',remember);window.removeEventListener('load',request);}};
}
