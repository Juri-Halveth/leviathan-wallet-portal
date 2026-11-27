"""Run the shipped Ethereum action dialog in a disposable local Chrome profile."""
# SPDX-License-Identifier: MIT
import argparse
import html
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
from threading import Thread


HERE = Path(__file__).resolve().parent
WALLET = HERE.parents[1]
PAGE = b'<!doctype html><meta charset="utf-8"><pre id="result">pending</pre><script type="module" src="/wallet-check.mjs"></script>'
SCRIPTS = {"wallet-actions.js", "wallet-actions-view.js", "wallet-plugins.js",
           "evm-actions-core.js", "evm-read.js", "time.js"}


class Fixture(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        if self.path == "/":
            data, mime = PAGE, "text/html"
        elif self.path == "/wallet-check.mjs":
            data, mime = (HERE / "wallet-check.mjs").read_bytes(), "application/javascript"
        elif self.path in {"/src/" + name for name in SCRIPTS}:
            data, mime = (WALLET / self.path.lstrip("/")).read_bytes(), "application/javascript"
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self'; connect-src 'none'; form-action 'none'")
        self.end_headers()
        self.wfile.write(data)


def browser_binary():
    if os.environ.get("CHROME_BIN"):
        return os.environ["CHROME_BIN"]
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        if path := shutil.which(name):
            return path
    candidates = [(os.getenv("ProgramFiles"), "Google/Chrome/Application/chrome.exe"),
                  (os.getenv("ProgramFiles(x86)"), "Microsoft/Edge/Application/msedge.exe")]
    return next((str(Path(base) / name) for base, name in candidates if base and (Path(base) / name).is_file()), None)


def run(chrome):
    with ThreadingHTTPServer(("127.0.0.1", 0), Fixture) as server, TemporaryDirectory() as profile:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            cmd = [chrome, "--headless", "--disable-gpu", "--no-first-run", "--disable-extensions",
                   "--disable-background-networking", "--disable-component-update", "--disable-sync",
                   "--user-data-dir=" + profile, "--dump-dom", "--virtual-time-budget=12000",
                   "http://127.0.0.1:" + str(server.server_port) + "/"]
            result = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True,
                                    encoding="utf8", errors="replace", timeout=45)
        finally:
            server.shutdown()
            thread.join()
    match = re.search(r'<pre id="result">([^<]*)</pre>', result.stdout)
    if result.returncode or not match or match[1] == "pending":
        raise RuntimeError("Browser did not return the test result. " + result.stderr[-600:])
    report = json.loads(html.unescape(match[1]))
    print(json.dumps(report, ensure_ascii=True))
    return int("failed" in report or len(report.get("passed", [])) != 10)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", default=browser_binary())
    args = parser.parse_args()
    if not args.browser:
        parser.error("Set CHROME_BIN to an installed Chrome or Chromium executable.")
    sys.exit(run(args.browser))
