import {evmChains,evmAddress,normalizeChain,walletRpc} from './evm-read.js';
import anchors from './evm-token-anchors.json';
import pools from './evm-pool-anchors.json';

const word=n=>BigInt(n).toString(16).padStart(64,'0');
const addressWord=a=>evmAddress(a).slice(2).toLowerCase().padStart(64,'0');
const plain=value=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,90);
function words(hex){if(typeof hex!=='string'||!/^0x(?:[a-fA-F0-9]{64})+$/.test(hex)||hex.length>8194)throw Error('Ungültige ABI-Antwort');return hex.slice(2).match(/.{64}/g);}
function uint(hex){return BigInt('0x'+words(hex)[0]);}
function addr(w){if(!/^0{24}[a-fA-F0-9]{40}$/.test(w))throw Error('Ungültige ABI-Adresse');return '0x'+w.slice(24).toLowerCase();}
function int24(w){const n=BigInt('0x'+w),signed=n>=1n<<255n?n-(1n<<256n):n;if(signed<-(1n<<23n)||signed>=(1n<<23n))throw Error('Ungültiger Tick');return Number(signed);}
async function jsonBound(url,options={}){
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw Error('HTTP '+r.status);
  const length=Number(r.headers.get('content-length')||0);if(length>2500000)throw Error('Antwortlimit erreicht');
  const text=await r.text();if(text.length>2500000)throw Error('Antwortlimit erreicht');return JSON.parse(text);
}
function tokenKey(chainId,address){return chainId+':'+address.toLowerCase();}
const catalog=new Map(anchors.tokens.map(t=>[tokenKey(t.chainId,t.address),t]));

export async function discoverEvmNetworks(provider,account,onResult,onState,isCurrent){
  account=evmAddress(account);
  const initialChain=normalizeChain(await walletRpc(provider,'eth_chainId'));
  let pointer=0;
  await Promise.all(Array.from({length:3},async()=>{
    while(pointer<evmChains.length&&isCurrent()){
      const chain=evmChains[pointer++];onState(chain,'reading');
      try{await discoverChain(chain,chain.chainId===initialChain?provider:null,account,onResult,isCurrent);if(isCurrent())onState(chain,'partial');}
      catch(err){if(isCurrent())onState(chain,'error',plain(err.message));}
    }
  }));
  if(!isCurrent())return;
  const [after,accounts]=await Promise.all([walletRpc(provider,'eth_chainId'),walletRpc(provider,'eth_accounts')]);
  if(normalizeChain(after)!==initialChain||!Array.isArray(accounts)||typeof accounts[0]!=='string'||accounts[0].toLowerCase()!==account.toLowerCase())throw Error('Wallet-Konto oder aktives Netzwerk während der Suche geändert. Bitte neu verbinden.');
}

async function discoverChain(chain,provider,account,onResult,isCurrent){
  let requests=0;const deadline=performance.now()+50000;
  async function rpc(method,params=[]){
    if(!isCurrent())throw Error('Suche abgelöst');
    if(++requests>210||performance.now()>deadline)throw Error('Lesebudget erreicht');
    if(provider)return walletRpc(provider,method,params);
    const result=await jsonBound(chain.rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:requests,method,params})});
    if(result.error)throw Error('RPC: '+plain(result.error.message));return result.result;
  }
  const reported=normalizeChain(await rpc('eth_chainId'));if(reported!==chain.chainId)throw Error('Netzwerkkennung der Quelle passt nicht');
  const block=await rpc('eth_blockNumber');if(typeof block!=='string'||!/^0x[0-9a-fA-F]+$/.test(block))throw Error('Blockhöhe nicht lesbar');
  const native=await rpc('eth_getBalance',[account,block]);if(typeof native!=='string'||!/^0x[0-9a-fA-F]{1,64}$/.test(native))throw Error('Guthaben nicht lesbar');
  const data={observationId:'OBS-'+crypto.randomUUID(),chainId:chain.chainId,chainIdentityVerified:!provider,chainBinding:provider?'SELECTED_WALLET_PROVIDER_REPORT':'CONFIGURED_PUBLIC_RPC_CHAIN_ID_CHECKED',address:account,endpoint:provider?'Ausgewählte Wallet · EIP-1193 RPC':chain.rpc,queriedAt:new Date().toISOString(),completedAt:new Date().toISOString(),height:BigInt(block).toString(),balances:[{denom:'wei',amount:BigInt(native).toString()}],tokenMetadata:{},poolPositions:[],errors:[{part:'Weitere DeFi-Protokolle',error:'Eigene Adapter erforderlich; fehlende Position ist kein Nullbestand'}],partial:[],coverage:{native:'AT_BOUND_BLOCK',erc20:'PENDING',pools:'PENDING',otherProtocols:'NOT_COVERED',indexer:'NOT_CONFIGURED'}};
  function emit(){data.completedAt=new Date().toISOString();if(isCurrent())onResult(chain,{...data,balances:[...data.balances],tokenMetadata:{...data.tokenMetadata},poolPositions:[...data.poolPositions],errors:[...data.errors],partial:[...data.partial],coverage:{...data.coverage}});}
  emit();
  const call=(contract,selector,args='')=>rpc('eth_call',[{to:evmAddress(contract),data:'0x'+selector+args},block]);
  const nativeId=Number(BigInt(chain.chainId)),candidates=new Map();
  for(const t of anchors.tokens.filter(t=>t.chainId===nativeId))candidates.set(t.address.toLowerCase(),{...t});
  if(chain.indexer){
    try{
      const list=await jsonBound(chain.indexer+'/api/v2/addresses/'+account+'/token-balances');
      if(!Array.isArray(list))throw Error('Indexerformat unbekannt');
      data.coverage.indexer={source:chain.indexer,rowsReturned:list.length,rowsInspected:Math.min(list.length,500),binding:'CONFIGURED_CHAIN_CANDIDATES_ONLY_BALANCES_RECHECKED_BY_RPC'};
      for(const row of list.slice(0,500)){
        const t=row.token;if(t?.type!=='ERC-20')continue;
        const a=evmAddress(t.address_hash||t.address).toLowerCase();
        if(!candidates.has(a))candidates.set(a,{chainId:nativeId,address:a,name:plain(t.name)||'Token',symbol:plain(t.symbol)||'TOKEN',decimals:Number(t.decimals),source:chain.indexer});
      }
    }catch(err){data.coverage.indexer={source:chain.indexer,state:'UNAVAILABLE',error:plain(err.message)};}
  }
  const tokenCandidates=[...candidates.values()].slice(0,96);let checked=0,unread=0,gtcChecked=false;const held=[];
  async function metaFor(address,seed={}){
    const a=address.toLowerCase(),known=catalog.get(tokenKey(nativeId,a));let decimals=null;
    try{const d=uint(await call(a,'313ce567'));if(d<=30n)decimals=Number(d);}catch{}
    return {base:a,name:plain(known?.name||seed.name)||'Token '+a.slice(0,8),symbol:plain(known?.symbol||seed.symbol)||'TOKEN',decimals,coingeckoId:known?.coingeckoId||null,metadataSource:known?'BOUND_TOKEN_LIST_AND_RPC_DECIMALS':'INDEXER_CANDIDATE_AND_RPC_DECIMALS'};
  }
  // Sequentially paced calls avoid triggering a burst of wallet permission/RPC work.
  for(const candidate of tokenCandidates){
    if(!isCurrent())return;
    if(performance.now()>deadline||requests>=180){data.partial.push('ERC20-Lesebudget');break;}
    try{
      const raw=uint(await call(candidate.address,'70a08231',addressWord(account)));checked++;if(nativeId===1&&candidate.address.toLowerCase()==='0xde30da39c46104798bb5aa3fe8b9e0e1f348163f')gtcChecked=true;
      if(raw===0n)continue;
      const a=candidate.address.toLowerCase(),meta=await metaFor(a,candidate);data.tokenMetadata[a]=meta;
      data.balances.push({denom:a,amount:raw.toString()});held.push({address:a,raw,meta});emit();
    }catch(err){unread++;if(data.errors.length<12)data.errors.push({part:'Token '+plain(candidate.symbol),error:plain(err.message)});if(/HTTP (401|403|429)|Lesebudget/.test(err.message)){data.partial.push('ERC20-Quelle oder Budget');break;}}
  }
  data.coverage.erc20={candidateCount:candidates.size,selected:tokenCandidates.length,checked,unread,selection:'INDEXER_PLUS_FINITE_BOUND_TOKEN_LIST',gtcEthereumChecked:nativeId===1?gtcChecked:null};
  if(checked<tokenCandidates.length||candidates.size>tokenCandidates.length)data.partial.push('ERC20-Kandidaten nicht vollständig gelesen');
  const managers=pools.managers.filter(m=>m.chainId===nativeId);
  let poolCount=0,managersRead=0;
  for(const manager of managers){
    try{
      const n=uint(await call(manager.address,'70a08231',addressWord(account))),limit=n>12n?12:Number(n);managersRead++;
      if(n>12n)data.partial.push('Uniswap-v3-Positionen über 12');
      for(let i=0;i<limit;i++){
        const id=uint(await call(manager.address,'2f745c59',addressWord(account)+word(i)));
        const p=words(await call(manager.address,'99fbab88',word(id)));if(p.length!==12)throw Error('Positionsformat unbekannt');
        const token0=addr(p[2]),token1=addr(p[3]),liquidity=BigInt('0x'+p[7]);
        const base='v3:'+manager.address.toLowerCase()+':'+id;
        data.tokenMetadata[base]={base,name:'Uniswap v3 · #'+id,symbol:'LP NFT',decimals:0,coingeckoId:null};
        data.poolPositions.push({base,amount:'1',protocol:'Uniswap v3',poolAddress:manager.address,positionId:id.toString(),token0,token1,fee:BigInt('0x'+p[4]).toString(),tickLower:int24(p[5]),tickUpper:int24(p[6]),liquidity:liquidity.toString(),tokensOwed0:BigInt('0x'+p[10]).toString(),tokensOwed1:BigInt('0x'+p[11]).toString(),valuation:'NOT_COMPUTED_NO_FAKE_ZERO'});poolCount++;emit();
      }
    }catch(err){data.errors.push({part:'Uniswap v3',error:plain(err.message)});}
  }
  // Probe only held LP-looking ERC20 candidates; generic tokens are not called pools.
  for(const token of held.filter(t=>/LP|UNI-V2|SLP|liquidity|pair|pool/i.test(t.meta.symbol+' '+t.meta.name)).slice(0,8)){
    try{
      const token0=addr(words(await call(token.address,'0dfe1681'))[0]),token1=addr(words(await call(token.address,'d21220a7'))[0]);
      const reserves=words(await call(token.address,'0902f1ac')),supply=uint(await call(token.address,'18160ddd'));
      if(supply===0n||token.raw>supply||token0===token1||reserves.length!==3||BigInt('0x'+reserves[0])>=(1n<<112n)||BigInt('0x'+reserves[1])>=(1n<<112n)||BigInt('0x'+reserves[2])>=(1n<<32n))continue;
      const shares=[token0,token1].map((a,i)=>({address:a,amount:(BigInt('0x'+reserves[i])*token.raw/supply).toString()}));
      // Replace the LP token with its two modeled underlying shares: no double count.
      const additions=[];
      for(const part of shares){const base='v2:'+token.address+':'+part.address,meta=await metaFor(part.address);data.tokenMetadata[base]={...meta,base};additions.push({base,amount:part.amount,protocol:'V2-kompatible Poolstruktur',poolAddress:token.address,lpAmount:token.raw.toString(),totalSupply:supply.toString(),underlying:part.address,valuation:'RESERVE_SHARE_MODEL_NOT_EXECUTABLE_QUOTE'});}
      data.balances=data.balances.filter(b=>b.denom!==token.address);data.poolPositions.push(...additions);poolCount++;emit();
    }catch{/* An LP-looking name alone never changes its classification. */}
  }
  data.coverage.pools={positionsObserved:poolCount,v3ManagersChecked:managersRead,v3LimitPerManager:12,v2:'UP_TO_8_HELD_LP_LOOKING_TOKENS',outsideScope:['custodied/staked LP receipts','Uniswap v4','other protocol storage']};
  emit();
}
