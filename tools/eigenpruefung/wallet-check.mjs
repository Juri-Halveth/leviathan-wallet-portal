// SPDX-License-Identifier: MIT
// This page uses the shipped dialog and a deterministic in-memory wallet.
import { mountWalletActions } from '/src/wallet-actions.js';
import { walletActionsDialog } from '/src/wallet-actions-view.js';
import { GTC_ADDRESS, ZERO_ADDRESS } from '/src/evm-actions-core.js';

const el = (id) => document.getElementById(id);
const from = '0x' + '1'.repeat(40);
const recipient = '0x' + '2'.repeat(40);
const hash = '0x' + 'a'.repeat(64);
const blockHash = '0x' + 'b'.repeat(64);
const balance = '0x29a2241af62c0000';
const turn = () => new Promise(resolve => setTimeout(resolve, 0));
const cases = [];

function check(condition, detail) {
  if (!condition) throw new Error(detail);
}

async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await turn();
  }
  throw new Error('UI did not settle: ' + el('send-status').textContent);
}

async function run() {
  document.body.insertAdjacentHTML('afterbegin', walletActionsDialog);
  let wall = 1700000000000, tick = 1000;
  Date.now = () => wall;
  Object.defineProperty(performance, 'now', {value: () => tick, configurable: true});
  let calls, accountRead, sendResult, receipt, account, chain;

  const provider = {
    async request({method, params}) {
      switch (method) {
        case 'eth_chainId': return chain;
        case 'eth_accounts':
          if (accountRead) await accountRead();
          return [account];
        case 'eth_getBalance': return balance;
        case 'eth_getCode': return '0x6000';
        case 'eth_call':
          return params[0].data?.startsWith('0x70a08231') ? balance : params[0].data ? '0x01' : '0x';
        case 'eth_estimateGas': return '0x5208';
        case 'eth_sendTransaction':
          calls.push(structuredClone(params[0]));
          return sendResult();
        case 'eth_getTransactionReceipt': return receipt;
        default: throw new Error('Unexpected fixture method ' + method);
      }
    }
  };
  const actions = mountWalletActions();
  el('lw-evm-actions').showModal();
  el('tab-send').click();

  async function preview(asset='ETH', to=recipient) {
    calls = [];
    chain = '0x1';
    account = from;
    accountRead = null;
    sendResult = () => hash;
    receipt = {transactionHash: hash, blockHash, status: '0x1'};
    actions.adoptConnection(provider, from, 'Test wallet');
    el('asset').value = asset;
    el('recipient').value = to;
    el('amount').value = '1';
    el('send-form').requestSubmit();
    await until(() => !el('preview').hidden && !el('preview-button').disabled);
    check(calls.length === 0, 'preview requested a transfer');
  }

  async function send() {
    el('send-button').click();
    await until(() => !el('preview-button').disabled);
  }

  async function caseOf(name, fn) {
    await fn();
    cases.push(name);
  }

  await caseOf('ETH confirmation matches the reviewed transfer', async () => {
    await preview();
    await send();
    check(calls.length === 1 && calls[0].from === from && calls[0].to === recipient
      && calls[0].value === '0xde0b6b3a7640000', 'incorrect ETH request');
    check(el('send-status').textContent.includes(hash) && el('send-status').textContent.includes('Block'), 'receipt missing');
  });
  await caseOf('GTC handoff uses the reviewed contract call', async () => {
    await preview('GTC');
    await send();
    const data = '0xa9059cbb' + recipient.slice(2).padStart(64,'0') + (10n ** 18n).toString(16).padStart(64,'0');
    check(calls.length === 1 && calls[0].to === GTC_ADDRESS && calls[0].value === '0x0'
      && calls[0].data === data, 'incorrect GTC request');
  });
  await caseOf('wall-clock expiry during the final wallet read', async () => {
    await preview();
    accountRead = () => { wall += 60000; };
    await send();
    check(calls.length === 0, 'expired wall clock: ' + calls.length + ' wallet handoffs');
    check(el('send-status').textContent.includes('60 Sekunden'), 'wall expiry reason missing');
  });
  await caseOf('monotonic expiry during the final wallet read', async () => {
    await preview();
    accountRead = () => { tick += 60000; };
    await send();
    check(calls.length === 0, 'expired monotonic clock: ' + calls.length + ' wallet handoffs');
    check(el('send-status').textContent.includes('60 Sekunden'), 'monotonic expiry reason missing');
  });
  await caseOf('wallet account changes', async () => {
    await preview();
    account = recipient;
    await send();
    check(calls.length === 0 && el('send-status').textContent.includes('Konto'), 'account changed');
  });
  await caseOf('wallet chain changes', async () => {
    await preview();
    chain = '0xa';
    await send();
    check(calls.length === 0 && el('send-status').textContent.includes('Mainnet'), 'chain changed');
  });
  await caseOf('null-address consent withdrawn during the wallet read', async () => {
    await preview('ETH', ZERO_ADDRESS);
    el('zero-confirm').click();
    accountRead = () => { el('zero-confirm').click(); };
    await send();
    check(calls.length === 0 && el('send-status').textContent.includes('Nulladresse'), 'withdrawn consent accepted');
  });
  await caseOf('one handoff while a second event is pending', async () => {
    await preview();
    let release;
    const delay = new Promise(resolve => { release = resolve; });
    accountRead = () => delay;
    el('send-button').click();
    el('send-button').dispatchEvent(new MouseEvent('click'));
    release();
    await until(() => !el('preview-button').disabled);
    check(calls.length === 1, 'more than one handoff');
  });
  await caseOf('ambiguous wallet outcome consumes the preview', async () => {
    await preview();
    sendResult = () => { throw new Error('test provider disconnected'); };
    await send();
    el('send-button').dispatchEvent(new MouseEvent('click'));
    await turn();
    check(calls.length === 1 && el('send-button').hidden && el('send-status').textContent.includes('unklar'),
      'ambiguous outcome can reuse preview');
  });
  await caseOf('receipt for a different hash is not reported as confirmation', async () => {
    await preview();
    receipt.transactionHash = '0x' + 'c'.repeat(64);
    await send();
    check(calls.length === 1 && el('send-status').textContent.includes('Transaktionshash')
      && !el('send-status').textContent.includes('im Block'), 'wrong receipt accepted');
  });
  return {passed: cases};
}

try {
  el('result').textContent = JSON.stringify(await run());
} catch (error) {
  el('result').textContent = JSON.stringify({failed: error.message, passed: cases});
}
