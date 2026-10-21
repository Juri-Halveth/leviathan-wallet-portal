# Keller: Portalstand vor dem Vault-Schnitt

**Archivpunkt:** Git-Tag `vault-keller-2026-10-21` auf Commit `b6327523743c751240976e0d5e910c9825a51efb`.

Der Tag hält den vollständigen früheren Quellstand wiederauffindbar. Er ist ein Quellarchiv und kein zweites veröffentlichtes Produkt. Ältere Git-Commits und fremde Kopien bleiben davon unberührt.

## Weiterhin aktiv

- Der leuchtende Browser Vault in `site/index.html` und `src/luminous-wallet.js`.
- Ethereum-Aktionen im Vault-Dialog: Adresse empfangen, ETH oder GTC senden und eine nicht ausführende ETH-Bitte exportieren.
- Die Oraichain-Konsole in `site/console.html` mit `src/app.js`. Sie ist ein Fachwerkzeug für Staking-Positionen; entsprechende Details im Vault führen gezielt dorthin.
- Netzwerk- und Preisreferenzen in `site/data/chains.json` und `site/data/valuation.json`.

## Aus dem aktiven Portal entfernt

| Früherer Baustein | Archivpfad am Tag | Grund für die Entfernung aus dem aktuellen Einstieg |
| --- | --- | --- |
| Zweite Dashboard-, Finder-, Markt-, News- und Laboroberfläche | `site/index.html`, `site/portal.css`, `src/portal.js` | Doppelte und überladene Oberfläche neben dem Vault |
| Projektsternkarte und Portfolioansicht der Altoberfläche | `src/project-view.js`, `src/portfolio-view.js` | Nur von der Altoberfläche verwendet |
| Markt- und News-Snapshots | `site/data/markets.json`, `site/data/news.json` | Nur von den entfernten Panels verwendet |

Die alten Mechanismen für Node-Vergleich, Recherche-Receipt und Auftragsgenerator können aus dem Tag einzeln weiterentwickelt werden. Eine spätere Übernahme erfolgt als eigener, getesteter Baustein im Vault.
