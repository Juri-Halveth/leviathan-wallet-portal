# LEVIATHAN selbst prüfen

Kann ein Empfänger nachrechnen, ob eine Station den erwarteten Auftrag beantwortet und die mitgelieferten Quellen richtig vermessen hat? `verify_exchange.py` prüft einen vollständigen Austausch für `catalogue-digests.v1`. Das veröffentlichte [Beispiel](example/) enthält eine synthetische Tabelle mit zwei Datenzeilen, den signierten Auftrag und die signierte Antwort. Die beiden Testidentitäten wurden eigens dafür erzeugt. Zum Prüfen genügen die drei Dateien und die zwei öffentlichen Vergleichswerte.

## Ausführen

Voraussetzungen für den vollständigen Test sind CPython 3.12 bis 3.14, Git Bash oder Bash und Chrome, Chromium oder Edge. Das Lockfile enthält SHA-256-Werte für die verwendeten Windows-x64- und Linux-glibc-Pakete für x86_64 und AArch64. Im Stammverzeichnis des Checkouts die Bibliotheken einmal installieren. Dieser Schritt lädt Pakete von PyPI.

```bash
python -m venv .venv
if [[ -f .venv/Scripts/activate ]]; then
  source .venv/Scripts/activate
else
  source .venv/bin/activate
fi
python -m pip install --only-binary=:all: --require-hashes -r tools/eigenpruefung/requirements.lock
```

Danach reicht ein Befehl. Der signierte Austausch lässt sich offline prüfen. Die Browserproben verwenden einen temporären lokalen HTTP-Server, ein frisches Browserprofil und eine simulierte Wallet.

```bash
bash tools/eigenpruefung/pruefen.sh
```

Zuerst erscheint `VERIFIED` mit den tatsächlich geprüften IDs. Danach folgen zwölf Dateiprüfungen und zehn Bedienabläufe. `HALVETH_REVIEW_PYTHON` wählt bei Bedarf eine bestehende Prüfumgebung. `CHROME_BIN` wählt einen vorhandenen Chromium-Browser. Die reine Dateiprüfung funktioniert auch ohne Browser oder Portal.

```bash
python tools/eigenpruefung/verify_exchange.py --example
```

Für einen eigenen Austausch stammen die beiden erwarteten Werte aus dem eigenen Auftragsbeleg und dem bereits bekannten Schlüssel des Antwortenden. Der Auftragswert ist SHA-256 der originalen Manifestbytes. Der Schlüsselwert ist SHA-256 des rohen öffentlichen Ed25519-Schlüssels. Die `pins.json` im Beispiel dient ausschließlich zum Nachrechnen dieses öffentlich mitgelieferten Beispiels.

```bash
python tools/eigenpruefung/verify_exchange.py \
  --request-drop "$ERWARTETER_AUFTRAG" --responder "$BEKANNTER_SCHLUESSELFINGERABDRUCK" \
  auftrag.hlv antwort.hlv quelle.hlv
```

## Was die Prüfer tatsächlich lesen

- Der Dateiprüfer liest die Originalbytes aller Manifeste, Signaturen und referenzierten Objekte. Er vergleicht Auftrag, Zufallskennung, Elternverweise, Revision und Antwortschlüssel. Für jede Quelle berechnet er die Objektdigests und zählt die deklarierten Relationen erneut. Bei einer Abweichung endet der Prozess mit Fehlerstatus. Die öffentliche Beispieldatei `source.hlv` enthält genau 30 Bytes Tabellendaten.
- Das akzeptierte Archivprofil ist bewusst klein. Obergrenzen sind 4 MiB je Drop, 64 deklarierte Objekte, 256 KiB je Objekt und 24 Quelldrops je Auftrag. Der Prüfer liest Dateien als Daten im Speicher. Er extrahiert und startet daraus nichts. Ob Inhalte wahr sind, ob der Schlüssel einer bestimmten Person gehört und wann eine Antwort entstand, erfordern andere Belege. Die V1-Nachricht enthält keine signierte Ablaufzeit oder Zielstation. Ein wiederholter Prüflauf darf dasselbe gültige Ergebnis liefern. Doppelte Ausführung muss der empfangende Dienst in seinem eigenen Zustand behandeln.
- Der Browsertest bedient den vorhandenen ETH/GTC-Dialog. Er prüft den gültigen Weg für beide Assets sowie Zeitablauf in beiden Uhren, Kontowechsel, Netzwechsel, zurückgezogene Nulladressenfreigabe, doppeltes Auslösen, unklaren Wallet-Ausgang und eine Quittung mit abweichendem Transaktionshash. Die endgültige Zustimmung in einer echten Wallet sowie Live-RPC und reale Abwicklung liegen außerhalb dieses Tests.

## Optional mit vorhandener Stationssoftware wiederholen

`station_sample.py` akzeptiert einen *lokal vertrauten* Stationsstand mit Manifest-Digest `ed933a8988e0f59866f868b081eb08e1f2f15a36cd2941db5eb701154123f580`. Es prüft dessen 52 Dateien vor dem Laden, erzeugt zwei temporäre Räume, empfängt eine Quelle zweimal, vergleicht die Signaturprüfer und liest die Suche zum selben Empfangsstand per CLI und lokaler HTTP-Schnittstelle. Eine zufällige private Kontrollzeichenfolge wird auf Auftauchen in diesen Exporten und der Suche des anderen Raums geprüft. Der Probelauf stellt den Testraum in einem separaten Verzeichnis wieder her.

```bash
python -B tools/eigenpruefung/station_sample.py "$STATIONS_PAYLOAD" "$NEUER_BEISPIELORDNER"
```

Der neue Ausgabeordner enthält die drei öffentlichen Beispieldateien und die Vergleichswerte. Jeder neue Lauf erzeugt neue Testschlüssel und eine neue Auftragskennung. Für den veröffentlichten Prüfdatensatz ist die Stationssoftware entbehrlich.

Die ursprünglichen Werkzeuge, Texte und die synthetische Probe in diesem Verzeichnis stehen unter [MIT](LICENSE). Für den übrigen Projektbestand gilt die [Lizenzkarte](../../LICENSES.md). Betreiberrechte und Außenwirkungen der einzelnen Funktionen sind in der [Kontrollkarte](BETRIEBSMODELL.md) aufgeführt.
