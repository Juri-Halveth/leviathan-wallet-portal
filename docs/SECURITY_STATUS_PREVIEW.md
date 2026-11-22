# Sicherheitsvorschau lokal prüfen

Der Sicherheitsstatus ist absichtlich `NOT_ATTESTED`. Die Seite macht **keine** Behauptung, dass ein YubiKey, Wallet-Mehrfachfreigabe oder eine Signatur auf LUCINETA bereits aktiv ist.

Vom Repository-Hauptordner:

```bash
node --test tests/security-status.test.mjs
python -m http.server --directory site 8000
```

Danach `http://localhost:8000/security.html` im Browser öffnen. Lokal muss die Anzeige **nicht verifiziert** zeigen.

## Veröffentlichung

Diese Vorschau ist für einen **Draft-Pull-Request** bestimmt. Sie wird erst nach geprüftem Merge und GitHub-Pages-Deployment über die normale Projektadresse erreichbar. Eine Veröffentlichung aktiviert weder hardwaregebundenes SSH noch eine Wallet-Policy.

Die Testfälle decken Statusvalidierung und vorsichtige Anzeige ab, **nicht** das Vorhandensein oder die Qualität einer konkreten Hardware- oder Serverkonfiguration. Der Browser enthält derzeit bewusst keinen Signaturprüfer.

Für echte Statusbelege brauchen wir ein separates authentifiziertes Export- und Prüfverfahren mit Signatur, Frischezeitraum und Quellrevision. Vor Einführung von Hardware-SSH auf LUCINETA muss ein unabhängiger Recovery-Zugang getestet werden.
