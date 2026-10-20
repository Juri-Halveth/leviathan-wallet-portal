// Detection only; authorisation is requested separately by a user click.
export async function getOWallet() {
  if (!window.owallet && document.readyState !== 'complete') {
    await new Promise(resolve => {
      const timer = setTimeout(done, 5000);
      function done() { clearTimeout(timer); window.removeEventListener('load', done); resolve(); }
      window.addEventListener('load', done, { once: true });
    });
  }
  const provider = window.owallet;
  if (!provider || typeof provider.enable !== 'function' || typeof provider.getKey !== 'function') {
    throw new Error('OWallet ist in diesem Browser nicht verfügbar. Öffne diese HTTPS-Seite in Chrome oder Edge mit aktiver OWallet-Erweiterung und erlaube ihr den Zugriff auf diese Website.');
  }
  return provider;
}
