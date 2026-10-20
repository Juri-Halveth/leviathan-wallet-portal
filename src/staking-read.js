import {address,endpoint,orai} from './core.js';
import {readRest} from './rest.js';

// Oraichain supports the delegator list even where the individual
// /delegations/{delegator}/{validator} gateway route returns HTTP 501.
export async function readDelegationMaximum(base,account,validator) {
  base=endpoint(base);account=address(account);validator=address(validator,'oraivaloper');
  const node=await readRest(base,'/cosmos/base/tendermint/v1beta1/blocks/latest');
  if((node.block?.header||node.sdk_block?.header)?.chain_id!=='Oraichain')throw new Error('MAX: Die Datenquelle meldet nicht das erwartete Netzwerk Oraichain.');
  const seen=new Set();let next='';
  for(let page=0;page<5;page++){
    const data=await readRest(base,'/cosmos/staking/v1beta1/delegations/'+account+'?pagination.limit=1000'+(next?'&pagination.key='+encodeURIComponent(next):''));
    if(!Array.isArray(data.delegation_responses))throw new Error('MAX: Die Staking-Liste hat ein unerwartetes Format.');
    const matches=data.delegation_responses.filter(d=>d.delegation?.validator_address===validator);
    if(matches.length>1)throw new Error('MAX: Mehrere Einträge für denselben Validator. Betrag bitte erneut prüfen.');
    if(matches.length){
      const d=matches[0];
      if(d.delegation.delegator_address!==account||d.balance?.denom!=='orai'||!/^(0|[1-9]\d*)$/.test(d.balance?.amount||''))throw new Error('MAX: Adresse oder Betrag des Staking-Eintrags passt nicht.');
      if(BigInt(d.balance.amount)===0n)throw new Error('Bei diesem Validator ist kein positiver Delegationsbetrag vorhanden.');
      return {amount:orai(d.balance.amount),rawAmount:d.balance.amount,account,validator,endpoint:base,queriedAt:new Date().toISOString(),source:'DELEGATOR_LIST',pagesRead:page+1};
    }
    next=data.pagination?.next_key||'';
    if(!next)throw new Error('Für diese Adresse wurde bei dem gewählten Validator keine Delegation gefunden.');
    if(typeof next!=='string'||seen.has(next))throw new Error('MAX: Die Datenquelle wiederholt eine Staking-Seite.');
    seen.add(next);
  }
  throw new Error('MAX: Seitenlimit erreicht. Der Betrag dieses Validators bleibt unbekannt.');
}
