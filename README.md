# LEVIATHAN Wallet Portal

Öffentlicher Browser Vault von **Juri Halveth (Juri Janovski)**: Wallets auswählen, unterstützte Netzwerke lesen und Positionen mit Quellen und Abdeckungslücken anzeigen. ETH- und GTC-Aktionen sind direkt in der Vault-Oberfläche integriert. Die Oraichain-Konsole bleibt als Fachbaustein über passende Positionsdetails erreichbar.

**Website:** https://juri-halveth.github.io/leviathan-wallet-portal/
**Code und Versionen:** https://github.com/Juri-Halveth/leviathan-wallet-portal

## Was funktioniert

- Erkennung und Auswahl unterstützter Browser-Wallets. Die bloße Erkennung fordert keinen Kontozugriff an; die Wallet erteilt Zugriff nach Nutzeraktion.
- Lesen öffentlicher Cosmos- und EVM-Positionen über konfigurierte Netzwerkdienste. Die Suche ist endlich und zeigt fehlende oder unbekannte Daten. Der Bereich „Öffentliche Adresse ansehen“ funktioniert ohne Wallet-Verbindung.
- Statische Netzwerk- und Preisreferenzen mit expliziten Zeitpunkten. Referenzpreise sind keine Ausführungskurse.
- Oraichain-Advanced-Konsole für Leseabfragen, Simulation und einen eigenen, sichtbaren Schritt zur Wallet-Signatur und zum Broadcast.
- [Ethereum-Wallet-Aktionen im Browser Vault](https://juri-halveth.github.io/leviathan-wallet-portal/#wallet-actions): eigene Empfangsadresse kopieren sowie ETH und offizielles Gitcoin GTC auf Ethereum Mainnet senden. Vor der Signatur werden Adresse, Guthaben, `eth_call` und Gasbedarf über die gewählte Browser-Wallet geprüft. Die Wallet bestätigt den endgültigen Transfer.
- Die Nulladresse kann für ETH ausdrücklich gewählt werden; dafür ist eine zusätzliche Bestätigung auf der Seite nötig. Der offizielle GTC-Contract weist Transfers an die Nulladresse zurück, was die Seite bei der Vorprüfung anzeigt.
- Eine ETH-Bitte an eine eingegebene Contract-Adresse lässt sich als nicht ausführendes JSON exportieren. Sie erzeugt weder eine Auszahlung noch einen Contract-Aufruf.
- Kein serverseitiges Nutzerkonto in diesem Repository.

Öffentliche Adressen und Abfragen können an die im Portal genannten RPC-, Explorer- und Marktdienste gehen. Seed-Phrases oder private Schlüssel werden hier nicht abgefragt. Eine Wallet-Verbindung allein löst keine Transaktion aus. Die Advanced-Konsole kann nach Simulation und ausdrücklicher Wallet-Bestätigung eine Mainnet-Transaktion auslösen; Netzwerkgebühren und Risiken der konkreten Aktion liegen bei der ausführenden Person.

Dies ist ein veröffentlichter Code- und UI-Prototyp, kein vollständiger Vermögensnachweis, keine Anlageberatung und kein Nachweis einer eigenständigen Leviathan-Blockchain. Die Tests in diesem Repository prüfen lokale Invarianten; sie ersetzen keinen Test mit einer realen Wallet oder einem Mainnet-Receipt. Für die Ethereum-Aktionen muss die Wallet im Browser erkannt werden, etwa als Erweiterung oder im Wallet-Browser. Ethereum-Netzwerkgebühren sind erforderlich und werden in der Wallet angezeigt.

## Lokal starten

```sh
npm ci --ignore-scripts
npm test
npm run build
```

Danach `site/` über einen lokalen statischen HTTP-Server ausliefern. Die GitHub-Pages-Action baut dieselben Dateien aus dem öffentlichen Quellstand und veröffentlicht `site/`.

## Herkunft und Rechte

Diese öffentliche Fassung ist ein kuratierter Export des Wallet-Moduls aus dem privaten Arbeitsrepo `halveth-data-metabolism`, Quellstand `ccdeae5dcc2ea2ad99375d1266a0b1ecd0369ebf`. Der Export enthält keine private Projektinventardatei, persönliche Wallet-Startwerte oder Git-Historie des Arbeitsrepos. Der Commit bezeichnet die technische Ausgangsfassung, keine pauschale Urheberrechts- oder Prioritätsbestätigung.

Die [Lizenzkarte](LICENSES.md) trennt neue Originalbeiträge, bereits vorhandene Komponenten, Abhängigkeiten und Fremddaten. [HALVETH PIRL 2.0](LICENSE-HALVETH-PIRL-2.0.md) ist eine bedingte, nichtkommerzielle source-available Lizenz für ausdrücklich zugeordnete Originalbeiträge und **keine OSI-Open-Source-Lizenz**. Frühere Rechte und Lizenzen werden durch den Export nicht rückwirkend geändert. [Drittanbieterhinweise](THIRD_PARTY_NOTICES.md) gelten für gebündelte Pakete. Kommerzielle Nutzung geschützter PIRL-Beiträge benötigt eine gesonderte Vereinbarung, soweit rechtlich erforderlich.

## Keller: früherer Portalstand

Der vollständige Stand vor der Bereinigung ist unter dem Git-Tag [`vault-keller-2026-10-21`](https://github.com/Juri-Halveth/leviathan-wallet-portal/tree/vault-keller-2026-10-21) auffindbar. Dazu gehören die frühere Projektsternkarte, Markt- und News-Panels, der lokale Auftragsgenerator und ihre Quellmodule. Sie sind nicht mehr Teil der Startansicht oder des aktuellen Vault-Bundles. Die Oraichain-Konsole blieb aktiv, weil Positionsdetails ihre Staking-Aktionen dorthin führen. Ein Archiv-Tag bewahrt den Quellstand; er löscht ältere Git-Historie oder bereits erstellte Kopien nicht.

Sicherheitsmeldungen: [SECURITY.md](SECURITY.md). Keine Seed-Phrase oder privaten Schlüssel mitsenden.
