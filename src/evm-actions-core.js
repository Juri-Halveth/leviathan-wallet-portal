export const ZERO_ADDRESS='0x0000000000000000000000000000000000000000';
export const GTC_ADDRESS='0xDe30da39c46104798bB5aA3fe8B9e0e1F348163F';
const UINT256=(1n<<256n)-1n;

export function address(value){
  if(typeof value!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(value))throw Error('Bitte eine vollständige Ethereum-Adresse mit 0x und 40 Hex-Zeichen eingeben.');
  return value;
}
export function amountToUnits(value,decimals=18){
  if(!Number.isInteger(decimals)||decimals<0||decimals>36||typeof value!=='string'||!new RegExp(`^(?:0|[1-9][0-9]*)${decimals?`(?:\\.[0-9]{1,${decimals}})?`:''}$`).test(value))throw Error('Betrag als positive Dezimalzahl mit höchstens '+decimals+' Nachkommastellen eingeben.');
  const [whole,fraction='']=value.split('.');
  const units=BigInt(whole)*10n**BigInt(decimals)+BigInt((fraction.padEnd(decimals,'0'))||'0');
  if(units===0n||units>UINT256)throw Error('Der Betrag muss größer als 0 und technisch darstellbar sein.');
  return units;
}
export function hexQuantity(value){if(typeof value!=='bigint'||value<0n||value>UINT256)throw Error('Ungültiger Zahlenwert.');return '0x'+value.toString(16);}
export function hexToBigInt(value){if(typeof value!=='string'||!/^0x[0-9a-fA-F]{1,64}$/.test(value))throw Error('Ungültige Wallet-Antwort.');return BigInt(value);}
export function buildTransfer({asset,from,to,amount}){
  from=address(from);to=address(to);const units=amountToUnits(amount);
  if(asset==='ETH')return {from,to,value:hexQuantity(units)};
  if(asset==='GTC')return {from,to:GTC_ADDRESS,value:'0x0',data:'0xa9059cbb'+to.slice(2).toLowerCase().padStart(64,'0')+units.toString(16).padStart(64,'0')};
  throw Error('Dieses Asset ist hier nicht freigegeben.');
}
export function sameAddress(a,b){return typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();}
export function preflightFailureMessage(stage,error){
  const labels={
    WALLET:'Wallet- und Netzwerkprüfung',INPUT:'Eingabeprüfung',CONTRACT_CODE:'GTC-Contract-Prüfung',
    TOKEN_BALANCE:'GTC-Guthabenprüfung',ETH_BALANCE:'ETH-Guthabenprüfung',
    TRANSFER_SIMULATION:'Transfer-Simulation per eth_call',GAS_ESTIMATE:'Gas-Schätzung',
    FINAL_WALLET:'Abschließende Wallet-Prüfung'
  };
  const detail=typeof error?.message==='string'&&error.message.trim()?error.message.trim().slice(0,300):'Unbekannter Fehler.';
  return `${labels[stage]||'Vorprüfung'}: ${detail} Eine Transaktion wurde nicht angefordert.`;
}
export function requestIntent({recipient,contract,amount='10000000000'}){
  return {type:'ETH_REQUEST_INTENT',version:1,chainId:'0x1',recipient:address(recipient),contract:address(contract),requestedWei:amountToUnits(amount).toString(),message:'Bitte ETH an die angegebene Wallet senden. Diese Bitte löst keine Überweisung aus.'};
}
