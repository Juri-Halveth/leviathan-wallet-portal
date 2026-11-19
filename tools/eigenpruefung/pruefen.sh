#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
set -euo pipefail
dir="$(cd -- "$(dirname -- "$0")" && pwd)"
cd -- "$dir"
if [[ -n "${HALVETH_REVIEW_PYTHON:-}" ]]; then
  runner="$HALVETH_REVIEW_PYTHON"
elif [[ -x ../../.venv/Scripts/python.exe ]]; then
  runner=../../.venv/Scripts/python.exe
elif [[ -x ../../.venv/bin/python ]]; then
  runner=../../.venv/bin/python
elif command -v python3 >/dev/null 2>&1; then
  runner=python3
else
  runner=python
fi
if ! "$runner" -B -c 'from importlib.metadata import version; import sys; sys.exit(version("cryptography") != "50.0.2")' 2>/dev/null; then
  echo 'Bitte die Python-Umgebung nach tools/eigenpruefung/README.md einrichten.' >&2
  exit 1
fi
"$runner" -B verify_exchange.py --example
"$runner" -B -m unittest -v test_exchange
"$runner" -B browser_check.py
