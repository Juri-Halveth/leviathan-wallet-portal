## Python packages for the separate local verifier

The optional verifier in `tools/eigenpruefung/` uses the following pinned Python packages. The Pages workflow installs them for its verification step before building the site; they are not included in the browser bundle. The license identifiers below come from the `METADATA` of the PyPI wheels whose SHA-256 digests are pinned in [`requirements.lock`](https://github.com/Juri-Halveth/leviathan-wallet-portal/blob/67ee2fc9be66c1d802a6c097ba8c41c424b0c054/tools/eigenpruefung/requirements.lock). All 17 pinned wheels were checked against their PyPI release digests and contain the listed license files. These packages retain their own licenses; the verifier's MIT license does not cover them.

| Package | Version | Wheel license expression | License files in each pinned wheel | PyPI release |
| --- | --- | --- | --- | --- |
| cryptography | 50.0.2 | Apache-2.0 OR BSD-3-Clause | `licenses/LICENSE`, `licenses/LICENSE.APACHE`, `licenses/LICENSE.BSD` | [cryptography 50.0.2](https://pypi.org/project/cryptography/50.0.2/) |
| cffi | 2.1.1 | MIT-0 | `licenses/LICENSE` | [cffi 2.1.1](https://pypi.org/project/cffi/2.1.1/) |
| pycparser | 3.12 | BSD-3-Clause | `licenses/LICENSE` | [pycparser 3.12](https://pypi.org/project/pycparser/3.12/) |
