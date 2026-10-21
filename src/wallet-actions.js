import {createWalletPlugins} from './wallet-plugins.js';
import {walletRpc,normalizeChain} from './evm-read.js';
import {ZERO_ADDRESS,GTC_ADDRESS,address,amountToUnits,hexToBigInt,buildTransfer,sameAddress,requestIntent} from './evm-actions-core.js';

const $=id=>document.getElementById(id);
let plugins,provider=null,account=null,epoch=0,preview=null,busy=false;
const setStatus=(id,message,kind='')=>{const node=$(id);node.textContent=message;node.className='status '+kind;};
function invalidate(){epoch++;preview=null;$('preview').hidden=true;$('send-button').hidden=true;$('send-button').disabled=true;$('zero-confirm').checked=false;$('zero-confirm-wrap').hidden=true;}
function updateButtons(){const connected=!!provider&&!!account;$('preview-button').disabled=!connected||busy;$('wish-button').disabled=!connected||busy;$('copy-address').disabled=!connected;$('connect').disabled=busy||!plugins?.list().some(x=>x.kind==='evm'&&x.available);}
function renderChoices(){const current=$('wallet-choice').value,options=plugins.list().filter(x=>x.kind==='evm');$('wallet-choice').replaceChildren();for(const item of options){const option=new Option(item.name+(item.available?'':' · nicht erkannt'),item.id);option.disabled=!item.available;$('wallet-choice').add(option);}if(options.some(x=>x.id===current&&x.available))$('wallet-choice').value=current;else $('wallet-choice').selectedIndex=options.findIndex(x=>x.available);if(!options.some(x=>x.available))setStatus('connection-status','Öffne diese Seite im Browser deiner Wallet oder in Chrome mit der Wallet-Erweiterung.');updateButtons();}
function clearConnection(message){detach(provider);provider=null;account=null;invalidate();$('account').textContent='Noch keine Wallet verbunden.';$('receive-address').textContent='Nach dem Verbinden erscheint deine Adresse.';setStatus('connection-status',message);updateButtons();}
async function boundWallet(){
  if(!provider||!account)throw Error('Bitte zuerst eine Wallet verbinden.');
  const [chain,accounts]=await Promise.all([walletRpc(provider,'eth_chainId'),walletRpc(provider,'eth_accounts')]);
  if(normalizeChain(chain)!=='0x1')throw Error('Bitte in deiner Wallet Ethereum Mainnet auswählen.');
  if(!Array.isArray(accounts)||!sameAddress(accounts[0],account))throw Error('Wallet-Konto gewechselt. Bitte erneut verbinden.');
  return account;
}
function detach(p){
  // The page keeps only one connection. Reloading also clears provider listeners.
  for(const [event,listener]of listeners){p?.removeListener?.(event,listener);}
  listeners=[];
}
let listeners=[];
function listen(p){for(const [event,message]of [['accountsChanged','Konto geändert. Bitte erneut verbinden.'],['chainChanged','Netzwerk geändert. Bitte erneut verbinden.'],['disconnect','Wallet getrennt.']]){const listener=()=>clearConnection(message);p.on?.(event,listener);listeners.push([event,listener]);}}
async function connect(){
  busy=true;updateButtons();invalidate();
  try{
    const item=plugins.get($('wallet-choice').value);if(item.kind!=='evm')throw Error('Bitte eine EVM-Wallet wählen.');
    const newProvider=item.provider;
    const accounts=await newProvider.request({method:'eth_requestAccounts'});
    if(!Array.isArray(accounts)||!accounts.length)throw Error('Die Wallet hat keine Adresse freigegeben.');
    const next=address(accounts[0]);
    if(normalizeChain(await walletRpc(newProvider,'eth_chainId'))!=='0x1')throw Error('Bitte in der Wallet Ethereum Mainnet wählen und erneut verbinden.');
    detach(provider);provider=newProvider;account=next;listen(provider);
    $('account').textContent=item.name+' · Ethereum Mainnet · '+account;
    $('receive-address').textContent=account;
    setStatus('connection-status','Verbunden. Adresse und Netzwerk sind bereit.','success');
  }catch(error){clearConnection(error.message||'Verbindung fehlgeschlagen.');}
  finally{busy=false;updateButtons();}
}
function showPreview(data){
  const node=$('preview');node.replaceChildren();
  const title=document.createElement('strong');title.textContent='Geprüfter Transfer';
  const dl=document.createElement('dl');
  for(const [label,value]of [['Von',data.from],['An',data.recipient],['Asset',data.asset],['Betrag',data.amount],['Gas-Schätzung',data.gas+' Einheiten'],['Netzwerk','Ethereum Mainnet']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);}
  node.append(title,dl);node.hidden=false;
  $('zero-confirm-wrap').hidden=!(data.asset==='ETH'&&sameAddress(data.recipient,ZERO_ADDRESS));
  $('send-button').hidden=false;refreshSendButton();
}
function refreshSendButton(){if(!preview)return;$('send-button').disabled=busy||(preview.asset==='ETH'&&sameAddress(preview.recipient,ZERO_ADDRESS)&&!$('zero-confirm').checked);}
async function checkTransfer(event){
  event.preventDefault();invalidate();busy=true;updateButtons();setStatus('send-status','Wallet und Transaktion werden geprüft …');const run=epoch;
  try{
    const from=await boundWallet(),asset=$('asset').value,recipient=address($('recipient').value.trim()),amount=$('amount').value.trim();
    const tx=buildTransfer({asset,from,to:recipient,amount});
    if(asset==='GTC'){
      const code=await walletRpc(provider,'eth_getCode',[GTC_ADDRESS,'latest']);
      if(typeof code!=='string'||code==='0x')throw Error('Der GTC-Contract ist auf diesem Netzwerk nicht erreichbar.');
      const balanceCall={to:GTC_ADDRESS,data:'0x70a08231'+from.slice(2).toLowerCase().padStart(64,'0')};
      const balance=hexToBigInt(await walletRpc(provider,'eth_call',[balanceCall,'latest']));
      if(amountToUnits(amount)>balance)throw Error('Dein GTC-Guthaben reicht für diesen Betrag nicht.');
    }else{
      const balance=hexToBigInt(await walletRpc(provider,'eth_getBalance',[from,'latest']));
      if(amountToUnits(amount)>balance)throw Error('Dein ETH-Guthaben reicht für diesen Betrag nicht.');
    }
    const callResult=await walletRpc(provider,'eth_call',[tx,'latest']);
    if(asset==='GTC'&&callResult!=='0x'&&hexToBigInt(callResult)===0n)throw Error('Der GTC-Contract hat den Transfer bei der Vorprüfung abgelehnt.');
    const gas=hexToBigInt(await walletRpc(provider,'eth_estimateGas',[tx])).toString();
    await boundWallet();
    if(run!==epoch)throw Error('Eingabe oder Wallet hat sich geändert. Bitte erneut prüfen.');
    preview={tx,asset,from,recipient,amount,gas,epoch,at:Date.now(),atMonotonic:performance.now()};showPreview(preview);
    setStatus('send-status','Prüfung erfolgreich. Die Wallet zeigt vor dem Senden noch einmal alle Daten.','success');
  }catch(error){setStatus('send-status',assetZeroMessage(error),'error');}
  finally{busy=false;updateButtons();refreshSendButton();}
}
function assetZeroMessage(error){if($('asset').value==='GTC'&&sameAddress($('recipient').value.trim(),ZERO_ADDRESS))return 'Der GTC-Contract weist Transfers an die Nulladresse zurück. Wähle eine andere Zieladresse.';return error?.message||'Prüfung fehlgeschlagen.';}
async function send(){
  if(!preview)return;const selected=preview;
  if(Date.now()<selected.at||Date.now()-selected.at>60000||performance.now()<selected.atMonotonic||performance.now()-selected.atMonotonic>60000){invalidate();setStatus('send-status','Die Prüfung ist abgelaufen oder die Zeitbasis hat sich geändert. Bitte erneut prüfen.','error');return;}
  if(selected.epoch!==epoch||selected.asset!==$('asset').value||selected.recipient!==$('recipient').value.trim()||selected.amount!==$('amount').value.trim()){invalidate();setStatus('send-status','Eingaben geändert. Bitte erneut prüfen.','error');return;}
  if(selected.asset==='ETH'&&sameAddress(selected.recipient,ZERO_ADDRESS)&&!$('zero-confirm').checked)return;
  busy=true;updateButtons();refreshSendButton();setStatus('send-status','Wallet öffnet die letzte Bestätigung …');
  try{
    await boundWallet();
    if(selected.epoch!==epoch)throw Error('Wallet oder Eingabe geändert.');
    const hash=await provider.request({method:'eth_sendTransaction',params:[selected.tx]});
    if(typeof hash!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('Wallet hat keinen gültigen Transaktionshash zurückgegeben.');
    invalidate();const a=document.createElement('a');a.href='https://etherscan.io/tx/'+encodeURIComponent(hash);a.target='_blank';a.rel='noopener noreferrer';a.textContent='Status im Explorer ansehen ↗';$('send-status').replaceChildren(document.createTextNode('Wallet meldet Transaktionshash: '+hash+' · '),a);$('send-status').className='status success';
    try{const receipt=await walletRpc(provider,'eth_getTransactionReceipt',[hash]);if(receipt?.status==='0x1')setStatus('send-status','Transaktion in einem Block bestätigt: '+hash,'success');else if(receipt?.status==='0x0')setStatus('send-status','Transaktion im Block fehlgeschlagen: '+hash,'error');}catch{}
  }catch(error){setStatus('send-status',error?.code===4001?'In der Wallet abgebrochen.':error.message||'Senden fehlgeschlagen.','error');}
  finally{busy=false;updateButtons();refreshSendButton();}
}
async function wish(event){
  event.preventDefault();busy=true;updateButtons();setStatus('wish-status','Contract wird geprüft …');
  try{const recipient=await boundWallet(),contract=address($('contract').value.trim()),amount=$('wish-amount').value.trim();const code=await walletRpc(provider,'eth_getCode',[contract,'latest']);if(typeof code!=='string'||code==='0x')throw Error('An dieser Adresse wurde kein Contract-Code gefunden.');await boundWallet();const intent=requestIntent({recipient,contract,amount});intent.createdAt=new Date().toISOString();const blob=new Blob([JSON.stringify(intent,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='leviathan-eth-bitte.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('wish-status','Bitte als JSON gespeichert. Eine Auszahlung braucht eine separate Zusage und Transaktion.','success');}
  catch(error){setStatus('wish-status',error.message||'Bitte konnte nicht erstellt werden.','error');}
  finally{busy=false;updateButtons();}
}
plugins=createWalletPlugins(renderChoices);renderChoices();updateButtons();
$('rescan').addEventListener('click',()=>plugins.request());
$('connect').addEventListener('click',connect);
$('copy-address').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(account);setStatus('connection-status','Adresse kopiert.','success');}catch{setStatus('connection-status','Kopieren fehlgeschlagen. Die Adresse steht vollständig im Feld.','error');}});
for(const id of ['asset','recipient','amount'])$(id).addEventListener('input',()=>{invalidate();setStatus('send-status','Eingabe geändert. Bitte Transfer erneut prüfen.');});
$('zero').addEventListener('click',()=>{$('recipient').value=ZERO_ADDRESS;invalidate();setStatus('send-status','Nulladresse eingesetzt. Bitte Transfer prüfen.');});
$('zero-confirm').addEventListener('change',refreshSendButton);
$('send-form').addEventListener('submit',checkTransfer);
$('send-button').addEventListener('click',send);
$('wish-form').addEventListener('submit',wish);
