"""Generate synthetic fixtures using a trusted installation of the pinned LEVIATHAN release."""
# SPDX-License-Identifier: MIT
import argparse
from contextlib import closing
import hashlib
from http.client import HTTPConnection
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.parse import urlencode
import zipfile

from verify_exchange import verify_exchange


RELEASE = "ed933a8988e0f59866f868b081eb08e1f2f15a36cd2941db5eb701154123f580"


def check(value, label):
    if not value:
        raise ValueError(label)


def bind_release(root):
    raw = (root / "RELEASE.json").read_bytes()
    check(hashlib.sha256(raw).hexdigest() == RELEASE, "unexpected station release")
    files = json.loads(raw)["files"]
    found = set()
    for path in root.rglob("*"):
        check(not path.is_symlink() and not path.is_junction(), "unexpected link")
        if path.is_file():
            found.add(path.relative_to(root).as_posix())
    check(found == set(files) | {"RELEASE.json"}, "release file set differs")
    for name, metadata in files.items():
        with (root / name).open("rb") as stream:
            check(os.fstat(stream.fileno()).st_size == metadata["bytes"]
                  and hashlib.file_digest(stream, "sha256").hexdigest() == metadata["sha256"],
                  "release file differs")
    return len(files)


def portal_query(server, query, at):
    with closing(HTTPConnection("127.0.0.1", server.server_port, timeout=5)) as client:
        client.request("GET", "/api/search?" + urlencode({"q": query, "at": at}))
        result = client.getresponse()
        check(result.status == 200, "local portal search failed")
        return json.loads(result.read())


def produce(payload, destination):
    # Only this particular operator-selected local distribution is loaded as code.
    release_files = bind_release(payload)
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(payload / "station"))
    sys.path.insert(0, str(payload / "client/nova/src"))
    import backup
    import exchange
    from halveth_nova.leviathan.portal import LocalServer
    entry = payload / "client/nova/examples/leviathan/client.py"

    with TemporaryDirectory() as temporary:
        scratch = Path(temporary)
        def room(name):
            group = scratch / name
            os.environ["HALVETH_LEVIATHAN_KEYS"] = str(group / "keys")
            instance = exchange.Room(group / "room")
            return instance, instance.init(name)
        a, alice = room("fixture-A")
        b, bob = room("fixture-B")
        check(alice["publisher"] != bob["publisher"], "expected separate participants")
        private_marker = secrets.token_hex(24)
        a.store.ingest_bytes("internal/control", private_marker.encode())
        a.stage("sample", "sample", "Spectrum sample", "Synthetic fixture, MIT",
                b"frequency,intensity\n10,7\n20,3\n")
        source, request, reply = [scratch / name for name in ("source.hlv", "request.hlv", "reply.hlv")]
        created = a.create("sample", source)
        first = b.receive(source.read_bytes())
        again = b.receive(source.read_bytes())
        check(again["state"] == "already-present" and again["receipt"] == first["receipt"], "duplicate import")
        exchange.create(a, [created["drop"]], RELEASE, request)
        exchange.answer(b, request, alice["publisher"], RELEASE, reply)
        accepted = exchange.verify(a, request, reply, bob["publisher"], scratch / "accept")
        a.receive(reply.read_bytes())
        pins = {"requestDrop": accepted["requestDrop"], "responder": bob["publisher"]}
        independent = verify_exchange(request, reply, [source], pins["requestDrop"], pins["responder"])
        check(independent["replyDrop"] == accepted["replyDrop"], "readers disagree")

        with LocalServer(b, 0) as server:
            worker = Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                for query, matched in (("Spectrum sample", 1), (private_marker, 0)):
                    command = [sys.executable, "-B", str(entry), "--workspace", str(b.store.root),
                               "search", query, "--at", str(first["receipt"])]
                    observed = json.loads(subprocess.check_output(command, text=True, encoding="utf8", timeout=15))
                    check(observed == portal_query(server, query, first["receipt"])
                          and observed["matched"] == matched, "CLI and portal search")
            finally:
                server.shutdown()
                worker.join()
        for path in (source, request, reply):
            with zipfile.ZipFile(path) as bundle:
                check(all(private_marker.encode() not in bundle.read(name)
                          for name in bundle.namelist()), "private fixture appeared in export")

        snapshot = backup.snapshot(scratch / "fixture-B", scratch / "backup")
        restored = backup.snapshot(scratch / "backup", scratch / "restore")
        check(snapshot == restored and restored["room"] == bob["room"], "test room restore")

        destination.mkdir(parents=True, exist_ok=False)
        for path in (source, request, reply):
            shutil.copyfile(path, destination / path.name)
        (destination / "pins.json").write_text(json.dumps(pins, indent=2) + "\n", encoding="utf8")
        return {"releaseFiles": release_files, "release": RELEASE, "checks": [
            "two test identities", "duplicate import preserves receipt", "station verifies answer",
            "independent verifier matches", "CLI and HTTP search at same receipt",
            "unpublished control absent from exports and peer search", "temporary test room restored"],
            "replyDrop": independent["replyDrop"]}


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("trusted_payload", type=Path, help="local build-03/payload, with release manifest")
    cli.add_argument("new_example_directory", type=Path)
    options = cli.parse_args()
    print(json.dumps(produce(options.trusted_payload.resolve(), options.new_example_directory), indent=2))
