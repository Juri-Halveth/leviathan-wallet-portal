// EVM chain registry and selected-wallet read utilities.
// Multi-network ERC20 and pool discovery is implemented in evm-discovery.js.
export const evmChains=[
  {id:'ethereum',name:'Ethereum',chainId:'0x1',symbol:'ETH',coin:'ethereum',rpc:'https://ethereum-rpc.publicnode.com',indexer:'https://eth.blockscout.com'},
  {id:'optimism',name:'Optimism',chainId:'0xa',symbol:'ETH',coin:'ethereum',rpc:'https://optimism-rpc.publicnode.com',indexer:'https://optimism.blockscout.com'},
  {id:'base',name:'Base',chainId:'0x2105',symbol:'ETH',coin:'ethereum',rpc:'https://base-rpc.publicnode.com',indexer:'https://base.blockscout.com'},
  {id:'arbitrum',name:'Arbitrum One',chainId:'0xa4b1',symbol:'ETH',coin:'ethereum',rpc:'https://arbitrum-one-rpc.publicnode.com'},
  {id:'bnb',name:'BNB Smart Chain',chainId:'0x38',symbol:'BNB',coin:'binancecoin',rpc:'https://bsc-rpc.publicnode.com'},
  {id:'polygon',name:'Polygon',chainId:'0x89',symbol:'POL',coin:'polygon-ecosystem-token',rpc:'https://polygon-bor-rpc.publicnode.com'},
  {id:'avalanche',name:'Avalanche C-Chain',chainId:'0xa86a',symbol:'AVAX',coin:'avalanche-2',rpc:'https://avalanche-c-chain-rpc.publicnode.com'},
].map(c=>({...c,kind:'evm',denom:'wei',decimals:18,write:false,coingeckoId:c.coin,source:'https://github.com/ethereum-lists/chains/blob/master/_data/chains/eip155-'+BigInt(c.chainId).toString()+'.json'}));

export function evmAddress(value){if(typeof value!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(value))throw Error('Die Wallet hat keine gültige EVM-Adresse geliefert.');return value;}
function quantity(value){if(typeof value!=='string'||!/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)||value.length>66)throw Error('Ungültiger RPC-Mengenwert.');return BigInt(value);}
export function normalizeChain(value){return '0x'+quantity(value).toString(16);}
export async function walletRpc(provider,method,params=[]){
  let timer;try{return await Promise.race([provider.request({method,params}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Wallet-Anfrage dauert zu lange. Bitte die Wallet prüfen und erneut versuchen.')),20000);})]);}finally{clearTimeout(timer);}
}
export async function readEvm(provider,address){
  address=evmAddress(address);const queriedAt=new Date().toISOString();
  const chainId=normalizeChain(await walletRpc(provider,'eth_chainId'));
  const chain=evmChains.find(c=>c.chainId===chainId);
  if(!chain)throw Error('Aktives Wallet-Netzwerk '+chainId+' hat hier noch keinen Adapter.');
  const block=await walletRpc(provider,'eth_blockNumber');quantity(block);
  const raw=await walletRpc(provider,'eth_getBalance',[address,block]);const amount=quantity(raw).toString();
  const [after,accounts]=await Promise.all([walletRpc(provider,'eth_chainId'),walletRpc(provider,'eth_accounts')]);
  if(normalizeChain(after)!==chainId||!Array.isArray(accounts)||typeof accounts[0]!=='string'||accounts[0].toLowerCase()!==address.toLowerCase())throw Error('Wallet-Konto oder Netzwerk während der Abfrage geändert. Bitte neu verbinden.');
  return {chain,data:{observationId:'OBS-'+crypto.randomUUID(),chainId,chainIdentityVerified:false,chainBinding:'SELECTED_WALLET_PROVIDER_REPORT',address,endpoint:'Ausgewählte Wallet · EIP-1193 RPC',queriedAt,completedAt:new Date().toISOString(),height:quantity(block).toString(),amount,balances:[{denom:'wei',amount}],errors:[{part:'ERC20, NFTs und DeFi',error:'Keine Token-/Protokolladapter in diesem Leseumfang'}],partial:[],coverage:'NATIVE_BALANCE_AT_BOUND_BLOCK_ONLY'}};
}
