// src/wallet-plugins.js
var cosmosSlots = [["owallet", "OWallet", "owallet"], ["keplr", "Keplr", "keplr"], ["leap", "Leap", "leap"]];
var validCosmos = (p) => p && typeof p.enable === "function" && typeof p.getKey === "function";
var validEvm = (p) => p && typeof p.request === "function";
function createWalletPlugins(onChange) {
  const announced = /* @__PURE__ */ new Map();
  let closed = false;
  function remember(event) {
    const info = event.detail?.info, p = event.detail?.provider;
    if (!validEvm(p) || typeof info?.uuid !== "string" || info.uuid.length > 100 || typeof info?.name !== "string") return;
    const id = "evm:" + info.uuid;
    if (announced.has(id) || announced.size >= 32) return;
    announced.set(id, { id, name: info.name.slice(0, 70), kind: "evm", provider: p, rdns: typeof info.rdns === "string" ? info.rdns.slice(0, 200) : "", discovery: "EIP6963" });
    if (!closed) onChange?.();
  }
  function list() {
    const entries = cosmosSlots.map(([id, name, slot]) => ({ id, name, kind: "cosmos", provider: validCosmos(window[slot]) ? window[slot] : null, available: validCosmos(window[slot]), discovery: "NAMED_SLOT" }));
    const evm = [...announced.values()];
    const add = (id, name, p) => {
      if (validEvm(p) && !evm.some((x) => x.provider === p)) evm.push({ id, name, kind: "evm", provider: p, discovery: "LEGACY_INJECTION" });
    };
    add("evm:trust-direct", "Trust Wallet", window.trustwallet?.ethereum);
    const injected = Array.isArray(window.ethereum?.providers) ? window.ethereum.providers : [window.ethereum];
    injected.slice(0, 20).forEach((p, i) => add("evm:legacy-" + i, p?.isTrust ? "Trust Wallet" : p?.isMetaMask ? "MetaMask" : "Browser EVM Wallet", p));
    for (const item of evm) entries.push({ ...item, available: true });
    for (const [id, name, rdns] of [["evm:missing-metamask", "MetaMask", "io.metamask"], ["evm:missing-trust", "Trust Wallet", "com.trustwallet.app"]]) {
      if (!evm.some((x) => x.rdns === rdns || x.name.toLowerCase().includes(name.toLowerCase()))) entries.push({ id, name, kind: "evm", available: false, provider: null });
    }
    return entries;
  }
  function request() {
    if (!closed) {
      window.dispatchEvent(new Event("eip6963:requestProvider"));
      onChange?.();
    }
  }
  window.addEventListener("eip6963:announceProvider", remember);
  queueMicrotask(request);
  window.addEventListener("load", request, { once: true });
  return { list, request, get(id) {
    const item = list().find((x) => x.id === id);
    if (!item?.available) throw Error("Diese Wallet wurde hier nicht erkannt. \xD6ffne die Seite im Browser mit der gew\xFCnschten Wallet-Erweiterung.");
    return item;
  }, close() {
    closed = true;
    window.removeEventListener("eip6963:announceProvider", remember);
    window.removeEventListener("load", request);
  } };
}

// src/evm-read.js
var evmChains = [
  { id: "ethereum", name: "Ethereum", chainId: "0x1", symbol: "ETH", coin: "ethereum", rpc: "https://ethereum-rpc.publicnode.com", indexer: "https://eth.blockscout.com" },
  { id: "optimism", name: "Optimism", chainId: "0xa", symbol: "ETH", coin: "ethereum", rpc: "https://optimism-rpc.publicnode.com", indexer: "https://optimism.blockscout.com" },
  { id: "base", name: "Base", chainId: "0x2105", symbol: "ETH", coin: "ethereum", rpc: "https://base-rpc.publicnode.com", indexer: "https://base.blockscout.com" },
  { id: "arbitrum", name: "Arbitrum One", chainId: "0xa4b1", symbol: "ETH", coin: "ethereum", rpc: "https://arbitrum-one-rpc.publicnode.com" },
  { id: "bnb", name: "BNB Smart Chain", chainId: "0x38", symbol: "BNB", coin: "binancecoin", rpc: "https://bsc-rpc.publicnode.com" },
  { id: "polygon", name: "Polygon", chainId: "0x89", symbol: "POL", coin: "polygon-ecosystem-token", rpc: "https://polygon-bor-rpc.publicnode.com" },
  { id: "avalanche", name: "Avalanche C-Chain", chainId: "0xa86a", symbol: "AVAX", coin: "avalanche-2", rpc: "https://avalanche-c-chain-rpc.publicnode.com" }
].map((c) => ({ ...c, kind: "evm", denom: "wei", decimals: 18, write: false, coingeckoId: c.coin, source: "https://github.com/ethereum-lists/chains/blob/master/_data/chains/eip155-" + BigInt(c.chainId).toString() + ".json" }));
function quantity(value) {
  if (typeof value !== "string" || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value) || value.length > 66) throw Error("Ung\xFCltiger RPC-Mengenwert.");
  return BigInt(value);
}
function normalizeChain(value) {
  return "0x" + quantity(value).toString(16);
}
async function walletRpc(provider2, method, params = []) {
  let timer;
  try {
    return await Promise.race([provider2.request({ method, params }), new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error("Wallet-Anfrage dauert zu lange. Bitte die Wallet pr\xFCfen und erneut versuchen.")), 2e4);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

// src/evm-actions-core.js
var ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
var GTC_ADDRESS = "0xDe30da39c46104798bB5aA3fe8B9e0e1F348163F";
var UINT256 = (1n << 256n) - 1n;
function address(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw Error("Bitte eine vollst\xE4ndige Ethereum-Adresse mit 0x und 40 Hex-Zeichen eingeben.");
  return value;
}
function amountToUnits(value, decimals = 18) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36 || typeof value !== "string" || !new RegExp(`^(?:0|[1-9][0-9]*)${decimals ? `(?:\\.[0-9]{1,${decimals}})?` : ""}$`).test(value)) throw Error("Betrag als positive Dezimalzahl mit h\xF6chstens " + decimals + " Nachkommastellen eingeben.");
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (units === 0n || units > UINT256) throw Error("Der Betrag muss gr\xF6\xDFer als 0 und technisch darstellbar sein.");
  return units;
}
function hexQuantity(value) {
  if (typeof value !== "bigint" || value < 0n || value > UINT256) throw Error("Ung\xFCltiger Zahlenwert.");
  return "0x" + value.toString(16);
}
function hexToBigInt(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{1,64}$/.test(value)) throw Error("Ung\xFCltige Wallet-Antwort.");
  return BigInt(value);
}
function buildTransfer({ asset, from, to, amount }) {
  from = address(from);
  to = address(to);
  const units = amountToUnits(amount);
  if (asset === "ETH") return { from, to, value: hexQuantity(units) };
  if (asset === "GTC") return { from, to: GTC_ADDRESS, value: "0x0", data: "0xa9059cbb" + to.slice(2).toLowerCase().padStart(64, "0") + units.toString(16).padStart(64, "0") };
  throw Error("Dieses Asset ist hier nicht freigegeben.");
}
function sameAddress(a, b) {
  return typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
}
function preflightFailureMessage(stage, error) {
  const labels = {
    WALLET: "Wallet- und Netzwerkpr\xFCfung",
    INPUT: "Eingabepr\xFCfung",
    CONTRACT_CODE: "GTC-Contract-Pr\xFCfung",
    TOKEN_BALANCE: "GTC-Guthabenpr\xFCfung",
    ETH_BALANCE: "ETH-Guthabenpr\xFCfung",
    TRANSFER_SIMULATION: "Transfer-Simulation per eth_call",
    GAS_ESTIMATE: "Gas-Sch\xE4tzung",
    FINAL_WALLET: "Abschlie\xDFende Wallet-Pr\xFCfung"
  };
  const detail = typeof error?.message === "string" && error.message.trim() ? error.message.trim().slice(0, 300) : "Unbekannter Fehler.";
  return `${labels[stage] || "Vorpr\xFCfung"}: ${detail} Eine Transaktion wurde nicht angefordert.`;
}
function requestIntent({ recipient, contract, amount = "10000000000" }) {
  return { type: "ETH_REQUEST_INTENT", version: 1, chainId: "0x1", recipient: address(recipient), contract: address(contract), requestedWei: amountToUnits(amount).toString(), message: "Bitte ETH an die angegebene Wallet senden. Diese Bitte l\xF6st keine \xDCberweisung aus." };
}

// src/wallet-actions.js
var $ = (id) => document.getElementById(id);
var plugins;
var provider = null;
var account = null;
var epoch = 0;
var preview = null;
var busy = false;
var setStatus = (id, message, kind = "") => {
  const node = $(id);
  node.textContent = message;
  node.className = "status " + kind;
};
function invalidate() {
  epoch++;
  preview = null;
  $("preview").hidden = true;
  $("send-button").hidden = true;
  $("send-button").disabled = true;
  $("zero-confirm").checked = false;
  $("zero-confirm-wrap").hidden = true;
}
function updateButtons() {
  const connected = !!provider && !!account;
  $("preview-button").disabled = !connected || busy;
  $("wish-button").disabled = !connected || busy;
  $("copy-address").disabled = !connected;
  $("connect").disabled = busy || !plugins?.list().some((x) => x.kind === "evm" && x.available);
}
function renderChoices() {
  const current = $("wallet-choice").value, options = plugins.list().filter((x) => x.kind === "evm");
  $("wallet-choice").replaceChildren();
  for (const item of options) {
    const option = new Option(item.name + (item.available ? "" : " \xB7 nicht erkannt"), item.id);
    option.disabled = !item.available;
    $("wallet-choice").add(option);
  }
  if (options.some((x) => x.id === current && x.available)) $("wallet-choice").value = current;
  else $("wallet-choice").selectedIndex = options.findIndex((x) => x.available);
  if (!options.some((x) => x.available)) setStatus("connection-status", "\xD6ffne diese Seite im Browser deiner Wallet oder in Chrome mit der Wallet-Erweiterung.");
  updateButtons();
}
function clearConnection(message) {
  detach(provider);
  provider = null;
  account = null;
  invalidate();
  $("account").textContent = "Noch keine Wallet verbunden.";
  $("receive-address").textContent = "Nach dem Verbinden erscheint deine Adresse.";
  setStatus("connection-status", message);
  updateButtons();
}
async function boundWallet() {
  if (!provider || !account) throw Error("Bitte zuerst eine Wallet verbinden.");
  const [chain, accounts] = await Promise.all([walletRpc(provider, "eth_chainId"), walletRpc(provider, "eth_accounts")]);
  if (normalizeChain(chain) !== "0x1") throw Error("Bitte in deiner Wallet Ethereum Mainnet ausw\xE4hlen.");
  if (!Array.isArray(accounts) || !sameAddress(accounts[0], account)) throw Error("Wallet-Konto gewechselt. Bitte erneut verbinden.");
  return account;
}
function detach(p) {
  for (const [event, listener] of listeners) {
    p?.removeListener?.(event, listener);
  }
  listeners = [];
}
var listeners = [];
function listen(p) {
  for (const [event, message] of [["accountsChanged", "Konto ge\xE4ndert. Bitte erneut verbinden."], ["chainChanged", "Netzwerk ge\xE4ndert. Bitte erneut verbinden."], ["disconnect", "Wallet getrennt."]]) {
    const listener = () => clearConnection(message);
    p.on?.(event, listener);
    listeners.push([event, listener]);
  }
}
async function connect() {
  busy = true;
  updateButtons();
  invalidate();
  try {
    const item = plugins.get($("wallet-choice").value);
    if (item.kind !== "evm") throw Error("Bitte eine EVM-Wallet w\xE4hlen.");
    const newProvider = item.provider;
    const accounts = await newProvider.request({ method: "eth_requestAccounts" });
    if (!Array.isArray(accounts) || !accounts.length) throw Error("Die Wallet hat keine Adresse freigegeben.");
    const next = address(accounts[0]);
    if (normalizeChain(await walletRpc(newProvider, "eth_chainId")) !== "0x1") throw Error("Bitte in der Wallet Ethereum Mainnet w\xE4hlen und erneut verbinden.");
    detach(provider);
    provider = newProvider;
    account = next;
    listen(provider);
    $("account").textContent = item.name + " \xB7 Ethereum Mainnet \xB7 " + account;
    $("receive-address").textContent = account;
    setStatus("connection-status", "Verbunden. Adresse und Netzwerk sind bereit.", "success");
  } catch (error) {
    clearConnection(error.message || "Verbindung fehlgeschlagen.");
  } finally {
    busy = false;
    updateButtons();
  }
}
function showPreview(data) {
  const node = $("preview");
  node.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = "Gepr\xFCfter Transfer";
  const dl = document.createElement("dl");
  for (const [label, value] of [["Von", data.from], ["An", data.recipient], ["Asset", data.asset], ["Betrag", data.amount], ["Gas-Sch\xE4tzung", data.gas + " Einheiten"], ["Netzwerk", "Ethereum Mainnet"]]) {
    const dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    dl.append(dt, dd);
  }
  node.append(title, dl);
  node.hidden = false;
  $("zero-confirm-wrap").hidden = !(data.asset === "ETH" && sameAddress(data.recipient, ZERO_ADDRESS));
  $("send-button").hidden = false;
  refreshSendButton();
}
function refreshSendButton() {
  if (!preview) return;
  $("send-button").disabled = busy || preview.asset === "ETH" && sameAddress(preview.recipient, ZERO_ADDRESS) && !$("zero-confirm").checked;
}
async function checkTransfer(event) {
  event.preventDefault();
  invalidate();
  busy = true;
  updateButtons();
  setStatus("send-status", "Wallet und Transaktion werden gepr\xFCft \u2026");
  const run = epoch;
  let stage = "WALLET";
  try {
    const from = await boundWallet();
    stage = "INPUT";
    const asset = $("asset").value, recipient = address($("recipient").value.trim()), amount = $("amount").value.trim();
    const tx = buildTransfer({ asset, from, to: recipient, amount });
    if (asset === "GTC") {
      stage = "CONTRACT_CODE";
      const code = await walletRpc(provider, "eth_getCode", [GTC_ADDRESS, "latest"]);
      if (typeof code !== "string" || code === "0x") throw Error("Der GTC-Contract ist auf diesem Netzwerk nicht erreichbar.");
      stage = "TOKEN_BALANCE";
      const balanceCall = { to: GTC_ADDRESS, data: "0x70a08231" + from.slice(2).toLowerCase().padStart(64, "0") };
      const balance = hexToBigInt(await walletRpc(provider, "eth_call", [balanceCall, "latest"]));
      if (amountToUnits(amount) > balance) throw Error("Dein GTC-Guthaben reicht f\xFCr diesen Betrag nicht.");
    } else {
      stage = "ETH_BALANCE";
      const balance = hexToBigInt(await walletRpc(provider, "eth_getBalance", [from, "latest"]));
      if (amountToUnits(amount) > balance) throw Error("Dein ETH-Guthaben reicht f\xFCr diesen Betrag nicht.");
    }
    stage = "TRANSFER_SIMULATION";
    const callResult = await walletRpc(provider, "eth_call", [tx, "latest"]);
    if (asset === "GTC" && callResult !== "0x" && hexToBigInt(callResult) === 0n) throw Error("Der GTC-Contract hat den Transfer bei der Vorpr\xFCfung abgelehnt.");
    stage = "GAS_ESTIMATE";
    const gas = hexToBigInt(await walletRpc(provider, "eth_estimateGas", [tx])).toString();
    stage = "FINAL_WALLET";
    await boundWallet();
    if (run !== epoch) throw Error("Eingabe oder Wallet hat sich ge\xE4ndert. Bitte erneut pr\xFCfen.");
    preview = { tx, asset, from, recipient, amount, gas, epoch, at: Date.now(), atMonotonic: performance.now() };
    showPreview(preview);
    setStatus("send-status", "Pr\xFCfung erfolgreich. Die Wallet zeigt vor dem Senden noch einmal alle Daten.", "success");
  } catch (error) {
    setStatus("send-status", preflightFailureMessage(stage, error), "error");
  } finally {
    busy = false;
    updateButtons();
    refreshSendButton();
  }
}
async function send() {
  if (!preview) return;
  const selected = preview;
  if (Date.now() < selected.at || Date.now() - selected.at > 6e4 || performance.now() < selected.atMonotonic || performance.now() - selected.atMonotonic > 6e4) {
    invalidate();
    setStatus("send-status", "Die Pr\xFCfung ist abgelaufen oder die Zeitbasis hat sich ge\xE4ndert. Bitte erneut pr\xFCfen.", "error");
    return;
  }
  if (selected.epoch !== epoch || selected.asset !== $("asset").value || selected.recipient !== $("recipient").value.trim() || selected.amount !== $("amount").value.trim()) {
    invalidate();
    setStatus("send-status", "Eingaben ge\xE4ndert. Bitte erneut pr\xFCfen.", "error");
    return;
  }
  if (selected.asset === "ETH" && sameAddress(selected.recipient, ZERO_ADDRESS) && !$("zero-confirm").checked) return;
  busy = true;
  updateButtons();
  refreshSendButton();
  setStatus("send-status", "Wallet \xF6ffnet die letzte Best\xE4tigung \u2026");
  try {
    await boundWallet();
    if (selected.epoch !== epoch) throw Error("Wallet oder Eingabe ge\xE4ndert.");
    const hash = await provider.request({ method: "eth_sendTransaction", params: [selected.tx] });
    if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw Error("Wallet hat keinen g\xFCltigen Transaktionshash zur\xFCckgegeben.");
    invalidate();
    const a = document.createElement("a");
    a.href = "https://etherscan.io/tx/" + encodeURIComponent(hash);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Status im Explorer ansehen \u2197";
    $("send-status").replaceChildren(document.createTextNode("Wallet meldet Transaktionshash: " + hash + " \xB7 "), a);
    $("send-status").className = "status success";
    try {
      const receipt = await walletRpc(provider, "eth_getTransactionReceipt", [hash]);
      if (receipt?.status === "0x1") setStatus("send-status", "Transaktion in einem Block best\xE4tigt: " + hash, "success");
      else if (receipt?.status === "0x0") setStatus("send-status", "Transaktion im Block fehlgeschlagen: " + hash, "error");
    } catch {
    }
  } catch (error) {
    setStatus("send-status", error?.code === 4001 ? "In der Wallet abgebrochen." : error.message || "Senden fehlgeschlagen.", "error");
  } finally {
    busy = false;
    updateButtons();
    refreshSendButton();
  }
}
async function wish(event) {
  event.preventDefault();
  busy = true;
  updateButtons();
  setStatus("wish-status", "Contract wird gepr\xFCft \u2026");
  try {
    const recipient = await boundWallet(), contract = address($("contract").value.trim()), amount = $("wish-amount").value.trim();
    const code = await walletRpc(provider, "eth_getCode", [contract, "latest"]);
    if (typeof code !== "string" || code === "0x") throw Error("An dieser Adresse wurde kein Contract-Code gefunden.");
    await boundWallet();
    const intent = requestIntent({ recipient, contract, amount });
    intent.createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const blob = new Blob([JSON.stringify(intent, null, 2) + "\n"], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url;
    a.download = "leviathan-eth-bitte.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
    setStatus("wish-status", "Bitte als JSON gespeichert. Eine Auszahlung braucht eine separate Zusage und Transaktion.", "success");
  } catch (error) {
    setStatus("wish-status", error.message || "Bitte konnte nicht erstellt werden.", "error");
  } finally {
    busy = false;
    updateButtons();
  }
}
plugins = createWalletPlugins(renderChoices);
renderChoices();
updateButtons();
var views = [...document.querySelectorAll("[data-view]")];
function activateView(name, focus = false) {
  for (const tab of views) {
    const active = tab.dataset.view === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    $(tab.getAttribute("aria-controls")).hidden = !active;
    if (active && focus) tab.focus();
  }
}
for (const tab of views) {
  tab.addEventListener("click", () => activateView(tab.dataset.view));
  tab.addEventListener("keydown", (event) => {
    const index = views.indexOf(tab);
    const next = event.key === "ArrowRight" ? (index + 1) % views.length : event.key === "ArrowLeft" ? (index - 1 + views.length) % views.length : event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : -1;
    if (next >= 0) {
      event.preventDefault();
      activateView(views[next].dataset.view, true);
    }
  });
}
activateView("receive");
$("rescan").addEventListener("click", () => plugins.request());
$("connect").addEventListener("click", connect);
$("copy-address").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(account);
    setStatus("connection-status", "Adresse kopiert.", "success");
  } catch {
    setStatus("connection-status", "Kopieren fehlgeschlagen. Die Adresse steht vollst\xE4ndig im Feld.", "error");
  }
});
for (const id of ["asset", "recipient", "amount"]) $(id).addEventListener("input", () => {
  invalidate();
  setStatus("send-status", "Eingabe ge\xE4ndert. Bitte Transfer erneut pr\xFCfen.");
});
$("zero").addEventListener("click", () => {
  $("recipient").value = ZERO_ADDRESS;
  invalidate();
  setStatus("send-status", "Nulladresse eingesetzt. Bitte Transfer pr\xFCfen.");
});
$("zero-confirm").addEventListener("change", refreshSendButton);
$("send-form").addEventListener("submit", checkTransfer);
$("send-button").addEventListener("click", send);
$("wish-form").addEventListener("submit", wish);
