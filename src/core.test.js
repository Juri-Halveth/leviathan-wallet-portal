import test from 'node:test';
import assert from 'node:assert/strict';
import {rawAmount,orai,address,message,assertFresh,endpoint} from './core.js';
import {fromBech32} from '@cosmjs/encoding';
test('money preserves all six decimals without floating point rounding',()=>{
  for(const [decimal,raw] of [['0','0'],['0.000001','1'],['1897.745','1897745000'],['1000000','1000000000000'],['9007199254740993.123456','9007199254740993123456']]){assert.equal(rawAmount(decimal),raw);assert.equal(orai(raw),decimal);}
});
test('rejects ambiguous, negative and excessive precision amounts',()=>{
  for(const x of ['1,5','-1','1e6','NaN','0.0000001','01','', '340282366920938463463374607431768211456'])assert.throws(()=>rawAmount(x));
});
test('recognizes actual ORAI addresses and rejects mixed validator role',()=>{
  assert.equal(fromBech32('orai1qurswpc8qurswpc8qurswpc8qurswpc8qq3epj').prefix,'orai');
  assert.equal(address('orai1qurswpc8qurswpc8qurswpc8qurswpc8qq3epj'),'orai1qurswpc8qurswpc8qurswpc8qurswpc8qq3epj');
  assert.throws(()=>address('oraivaloper1pqyqszqgpqyqszqgpqyqszqgpqyqszqgxjcywv'));
  assert.throws(()=>address('orai1qurswpc8qurswpc8qurswpc8qurswpc8qq3epq'));
});
test('changed wallet, changed inputs and old simulations cannot be signed',()=>{
  const p={snapshot:'original',sender:'alice',time:1000,monotonicTime:100};
  assert.doesNotThrow(()=>assertFresh(p,'original','alice',2000,200));
  assert.throws(()=>assertFresh(p,'changed','alice',2000,200));
  assert.throws(()=>assertFresh(p,'original','bob',2000,200));
  assert.throws(()=>assertFresh(p,'original','alice',62000,200));
  assert.throws(()=>assertFresh(null,'original','alice',2000));
});

test('clock rollback, missing clock data and monotonic expiration invalidate simulation',()=>{
  const p={snapshot:'s',sender:'a',time:10000,monotonicTime:500};
  assert.throws(()=>assertFresh(p,'s','a',9999,501),/Zeitbasis/);
  assert.throws(()=>assertFresh(p,'s','a',10001,499),/Zeitbasis/);
  assert.throws(()=>assertFresh(p,'s','a',10001,60500),/60 Sekunden/);
  assert.throws(()=>assertFresh({...p,time:NaN},'s','a',10001,501),/Zeitbasis/);
  assert.throws(()=>assertFresh({...p,monotonicTime:undefined},'s','a',10001,501),/Zeitbasis/);
});

test('contract JSON rejects duplicate keys including escaped and nested forms',()=>{
  for(const raw of ['{"claim":{},"claim":{}}','{"send":{"amount":"1","amount":"2"}}','{"send":{"a":1,"\\u0061":2}}'])assert.throws(()=>message(raw),/Doppelter/);
  assert.deepEqual(message('{"send":{"items":[{"a":1},{"a":2}],"label":"a:b"}}'),{send:{items:[{a:1},{a:2}],label:'a:b'}});
});
test('requires explicit contract action and HTTPS RPC',()=>{
  for(const x of ['{}','[]','null','{"a":{},"b":{}}'])assert.throws(()=>message(x));
  assert.deepEqual(message('{"claim":{}}'),{claim:{}});
  assert.throws(()=>endpoint('http://example.org'));
  assert.equal(endpoint('https://example.org/'),'https://example.org');
});
