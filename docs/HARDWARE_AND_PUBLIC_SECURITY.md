# LEVIATHAN · Hardware-Schlüssel und öffentliche Sicherheitslage

**Vorschau vom 22.11.2026, kein aktivierter Schutzmechanismus.** Der öffentliche Sicherheitsstatus darf nur überprüfbare Aussagen enthalten. Die Dateien unter `site/security*` zeigen absichtlich ausnahmslos `NOT_VERIFIED` an; der Browser implementiert derzeit **keine** kryptografische Signaturprüfung.

## Vier verschiedene Vertrauensgrenzen

| Bereich | Ziel | Grenze |
| --- | --- | --- |
| LUCINETA SSH | FIDO2-Hardware-Schlüssel mit Touch und PIN/Benutzerverifikation, OpenSSH `ed25519-sk` oder `ecdsa-sk` | Der Pi muss diesen Schlüssel serverseitig als Authentisierung verlangen. Ein vorhandener alternativer Software-Schlüssel oder ein Passwort würde sonst einen anderen Zugangsweg lassen. |
| GitHub | Sicherheitsschlüssel/Passkey für Konto und optional separater Git-Signierschlüssel | GitHub-Anmeldung schützt keine anderen Systeme automatisch. |
| LEVIATHAN Web | Serverseitig geprüfte WebAuthn-Challenge für sensible eigene Portalaktionen | Eine statische HTML-Seite kann keine Browser-Wallet oder fremde Blockchain-Transaktion erzwingen/verbieten. |
| Wallet-Vermögen | Smart Account mit mehreren unabhängigen Signern und einem Schwellenwert über 1 | Bei einer herkömmlichen EOA genügt der Seed/Private Key nach wie vor zur direkten Transaktion. Ein FIDO2-YubiKey ist nicht automatisch eine Ethereum-Hardware-Wallet. |

## Vorsichtige Einführungsreihenfolge ohne SSH-Sperre

1. Bestehenden funktionierenden Zugang, authentifizierte Host-Identität, Recovery-Kopie und zweiten Rückweg beibehalten. Kein automatischer Neustart und kein Eingriff in `sshd_config`.
2. Hardware und Client prüfen: `ssh -V`, `command -v ssh-keygen`. Auf Windows kann Git Bash eine andere OpenSSH-Version als Windows selbst verwenden. FIDO2-Unterstützung muss tatsächlich vorhanden sein.
3. Nur mit **physisch vorhandenem** FIDO2-Schlüssel auf Windows optional ein eigenes Schlüsselmaterial erzeugen: `ssh-keygen -t ed25519-sk -O verify-required -f "$HOME/.ssh/halvethpi_yubikey_sk" -C "HALVETH-LUCINETA-HARDWARE"`. Dazu PIN setzen, Schlüssel berühren. Bei nicht unterstützter Key-Art siehe Herstellerdokumentation für `ecdsa-sk`.
4. Nur den **öffentlichen** Schlüssel auf dem eigenen Pi zum Konto `halvethpi` hinzufügen, während die bisherige Sitzung bestehen bleibt. Einen zweiten unabhängigen Login mit dem Hardware-Schlüssel testen.
5. Erst nach erfolgreichem Recovery-Test serverseitige FIDO2-User-Verification und Einschränkung anderer Login-Wege planen. Solange andere Schlüssel gültig sind, ist Hardware **nicht verpflichtend**.
6. Für ETH/GTC separat ein Smart-Account-/Multisig-Design mit unabhängigen Wallet-Signern und dokumentierten Wiederherstellungswegen auswählen, zuerst ausschließlich testweise. Die Änderung der vermögenshaltenden Wallet erfolgt nicht automatisch.

## Sicherheitsanzeige

Eine öffentliche Statusseite darf **keine** privaten SSH-Schlüssel, Seeds, PINs, Recovery-Codes, internen IPs/MAC-Adressen oder direkten Admin-Endpunkte enthalten. Die spätere Attestierung braucht eine zuvor authentisch gebundene öffentliche Signaturidentität, eine gültige Signatur, Quellversionsbindung, Zeitbegrenzung und unabhängigen Prüfer. Bei fehlenden oder abgelaufenen Belegen lautet der Status **nicht verifiziert**, nicht „sicher“.

Die aktuelle Vorschau liest nur ihre eigene statische `security-status.json`, baut keine Verbindung zum Pi auf, sendet keine Wallet-Transaktionen und kann nicht als Nachweis einer konfigurierten Hardware-Pflicht dienen.

## Stand und Abnahme

- Vorhandene Pi-/GHOST-Läufe: vom Betreiber protokolliert, aber nicht als aktive Hardware-Key-Policy nachgewiesen.
- YubiKey an LUCINETA gebunden: **nicht verifiziert**.
- Hardware-Key-only SSH: **nicht verifiziert**.
- On-chain Mehrfachfreigabe: **nicht verifiziert**.
- Öffentliche Signatur-Attestierung: **nicht implementiert**.
- Vollständige Restore-Probe auf unabhängigem Ziel: **nicht verifiziert**.

## Quellen

- https://developers.yubico.com/SSH/Securing_SSH_with_FIDO2.html
- https://manpages.debian.org/trixie/openssh-server/sshd_config.5.en.html
- https://help.safe.global/articles/1038062742-what-safe-setup-should-i-use
- https://developers.yubico.com/WebAuthn/WebAuthn_Developer_Guide/index.html
