import test from 'node:test';
import assert from 'node:assert/strict';
import {ZERO_ADDRESS,GTC_ADDRESS,address,amountToUnits,hexToBigInt,buildTransfer,requestIntent} from './evm-actions-core.js';

const sender='0x1111111111111111111111111111111111111111';
const target='0x2222222222222222222222222222222222222222';
test('exact ETH and GTC units use bigint without rounding',()=>{
  assert.equal(amountToUnits('0.000000000000000001'),1n);
  assert.equal(amountToUnits('10000000000'),10000000000000000000000000000n);
  assert.equal(amountToUnits('1.234567890123456789'),1234567890123456789n);
  assert.equal(amountToUnits('7',0),7n);
  assert.throws(()=>amountToUnits('7.5',0));
  assert.equal(hexToBigInt('0x'+'0'.repeat(63)+'a'),10n);
});
test('invalid address and amounts are rejected before a wallet request',()=>{
  for(const bad of ['','0x1','0x'+'g'.repeat(40)])assert.throws(()=>address(bad));
  for(const bad of ['','0','-1','01','1e8','1,5','0.0000000000000000001','1.',' 1','2'.repeat(100)])assert.throws(()=>amountToUnits(bad));
});
test('ETH zero recipient is explicit, ERC20 uses its contract and encoded recipient',()=>{
  assert.deepEqual(buildTransfer({asset:'ETH',from:sender,to:ZERO_ADDRESS,amount:'1'}),{from:sender,to:ZERO_ADDRESS,value:'0xde0b6b3a7640000'});
  const tx=buildTransfer({asset:'GTC',from:sender,to:target,amount:'2.5'});
  assert.equal(tx.to,GTC_ADDRESS);
  assert.equal(tx.value,'0x0');
  assert.equal(tx.data,'0xa9059cbb'+target.slice(2).padStart(64,'0')+(25n*10n**17n).toString(16).padStart(64,'0'));
  assert.throws(()=>buildTransfer({asset:'FAKE',from:sender,to:target,amount:'1'}));
});
test('ETH request intent contains no executable transaction or signature',()=>{
  const intent=requestIntent({from:sender,contract:target,amount:'10000000000'});
  assert.equal(intent.requestedWei,'10000000000000000000000000000');
  assert.equal(intent.contract,target);
  assert.equal(Object.hasOwn(intent,'data'),false);
  assert.equal(Object.hasOwn(intent,'signature'),false);
});
