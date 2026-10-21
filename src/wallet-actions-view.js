export const walletActionsDialog = `
  <dialog id="lw-evm-actions" class="lw-dialog lw-action-dialog" aria-labelledby="lw-evm-title">
    <button id="lw-evm-close" class="lw-close" aria-label="Wallet-Aktionen schließen">×</button>
    <p class="lw-kicker">LEVIATHAN / DEINE AKTIONEN</p>
    <h2 id="lw-evm-title">Empfangen. Prüfen. Senden.</h2>
    <p class="lw-action-lead">ETH und GTC auf Ethereum Mainnet – direkt aus deinem Browser Vault.</p>
    <div class="lw-action-connect">
      <div id="action-connect-choice"><label for="wallet-choice">Ethereum-Wallet</label>
        <div class="lw-action-connect-row"><select id="wallet-choice" aria-label="Erkannte Wallet wählen"></select><button id="rescan" type="button">Neu suchen ↻</button><button id="connect" type="button">Verbinden ↗</button></div>
      </div>
      <p id="account" class="lw-action-address">Noch keine Wallet verbunden.</p>
      <p id="connection-status" class="status" role="status" aria-live="polite"></p>
    </div>
    <div class="view-tabs" role="tablist" aria-label="Wallet-Aktion">
      <button class="view-tab active" id="tab-receive" type="button" role="tab" aria-selected="true" aria-controls="view-receive" data-view="receive">Empfangen</button>
      <button class="view-tab" id="tab-send" type="button" role="tab" aria-selected="false" aria-controls="view-send" data-view="send">Senden</button>
      <button class="view-tab" id="tab-wish" type="button" role="tab" aria-selected="false" aria-controls="view-wish" data-view="wish">ETH-Bitte</button>
    </div>
    <section id="view-receive" class="view-panel" role="tabpanel" aria-labelledby="tab-receive">
      <h3>Deine Empfangsadresse.</h3>
      <p>Nach dem Verbinden kannst du diese Adresse teilen.</p>
      <div id="receive-address" class="lw-action-address lw-action-display">Nach dem Verbinden erscheint deine Adresse.</div>
      <button id="copy-address" type="button" disabled>Adresse kopieren ↗</button>
    </section>
    <section id="view-send" class="view-panel" role="tabpanel" aria-labelledby="tab-send" hidden>
      <h3>Transfer vorbereiten.</h3>
      <p>Erst prüfen, dann in deiner Wallet bestätigen.</p>
      <form id="send-form">
        <label for="asset">Asset</label><select id="asset"><option value="ETH">ETH · Ethereum</option><option value="GTC">GTC · Gitcoin</option></select>
        <label for="recipient">Zieladresse</label><input id="recipient" autocomplete="off" spellcheck="false" placeholder="0x…" required>
        <button id="zero" class="lw-action-quiet" type="button">Nulladresse einsetzen</button>
        <label for="amount">Betrag</label><input id="amount" inputmode="decimal" autocomplete="off" placeholder="0.0" required>
        <button id="preview-button" type="submit" disabled>Transfer prüfen ↗</button>
      </form>
      <div id="preview" class="preview" hidden></div>
      <label id="zero-confirm-wrap" class="check" hidden><input id="zero-confirm" type="checkbox"> Ich will ETH bewusst an die Nulladresse senden. Dieser Transfer ist endgültig.</label>
      <button id="send-button" type="button" disabled hidden>In Wallet bestätigen ↗</button>
      <p id="send-status" class="status" role="status" aria-live="polite"></p>
    </section>
    <section id="view-wish" class="view-panel" role="tabpanel" aria-labelledby="tab-wish" hidden>
      <h3>Eine ETH-Bitte speichern.</h3>
      <p>Die JSON-Datei ist eine Anfrage, keine Auszahlung.</p>
      <form id="wish-form">
        <label for="contract">Smart-Contract-Adresse auf Ethereum</label><input id="contract" autocomplete="off" spellcheck="false" placeholder="0x…" required>
        <label for="wish-amount">Gewünschte ETH</label><input id="wish-amount" inputmode="decimal" value="10000000000" required>
        <button id="wish-button" type="submit" disabled>Bitte als JSON speichern ↓</button>
      </form>
      <p id="wish-status" class="status" role="status" aria-live="polite"></p>
    </section>
  </dialog>`;
