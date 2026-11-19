"""Independently verify a complete LEVIATHAN catalogue-digests.v1 exchange offline."""
# SPDX-License-Identifier: MIT
import argparse
import hashlib
import io
import json
import re
import stat
import struct
import sys
import zipfile
import zlib
from dataclasses import dataclass
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


MIB = 1024 * 1024
DIGEST = re.compile(r"[a-f0-9]{64}")
OPERATION = "catalogue-digests.v1"


class InvalidExchange(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise InvalidExchange(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def is_digest(value):
    return isinstance(value, str) and DIGEST.fullmatch(value) is not None


def unique_object(pairs):
    fields = {}
    for name, value in pairs:
        require(name not in fields, "duplicate JSON field")
        fields[name] = value
    return fields


def invalid_number(_):
    raise InvalidExchange("unexpected non-integer JSON number")


def parse_json(raw):
    return json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object,
                      parse_float=invalid_number, parse_constant=invalid_number)


def member_bytes(archive, info, limit):
    require(0 <= info.file_size <= limit, "member exceeds size limit")
    with archive.open(info) as handle:
        value = handle.read(info.file_size + 1)
    require(len(value) == info.file_size, "incomplete member")
    return value


@dataclass
class Drop:
    identifier: str
    publisher: str
    manifest: dict
    payloads: dict


def read_drop(path):
    with Path(path).open("rb") as handle:
        data = handle.read(4 * MIB + 1)
    require(22 <= len(data) <= 4 * MIB, "drop exceeds size limit or is truncated")
    # Bound the central directory before allowing the ZIP reader to allocate entries.
    magic, disk, start_disk, disk_count, count, size, offset, comment = struct.unpack(
        "<4s4H2IH", data[-22:])
    require(magic == b"PK\x05\x06" and data.startswith(b"PK\x03\x04")
            and disk == start_disk == comment == 0 and disk_count == count
            and 2 <= count <= 66 and size <= 16384 and offset + size == len(data) - 22,
            "unsupported ZIP directory")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        require(len(entries) == count, "ZIP entry count differs")
        files = {}
        for info in entries:
            name = info.orig_filename
            require(name == info.filename and name not in files and (
                name in {"manifest.json", "ed25519.sig"} or re.fullmatch(r"objects/[0-9a-f]{64}", name)),
                "unexpected or duplicate member")
            require(info.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
                    and info.flag_bits & ~0x80e == 0 and info.external_attr & 0x410 == 0
                    and stat.S_IFMT(info.external_attr >> 16) in (0, stat.S_IFREG),
                    "unsupported ZIP member")
            files[name] = info
        require({"manifest.json", "ed25519.sig"} <= files.keys(), "missing signed manifest")
        raw = member_bytes(archive, files.pop("manifest.json"), 96 * 1024)
        sig = member_bytes(archive, files.pop("ed25519.sig"), 64)
        m = parse_json(raw)
        require(isinstance(m, dict) and m.get("contract") == "halveth.leviathan.drop.v1"
                and m.get("type") == "publication", "unsupported publication")
        require(is_digest(m.get("public_key")) and len(sig) == 64, "invalid key or signature length")
        key = bytes.fromhex(m["public_key"])
        try:
            Ed25519PublicKey.from_public_bytes(key).verify(sig, raw)
        except InvalidSignature as exc:
            raise InvalidExchange("signature mismatch") from exc
        require(isinstance(m.get("parents"), list) and len(m["parents"]) <= 32
                and all(is_digest(p) for p in m["parents"])
                and len(set(m["parents"])) == len(m["parents"]), "invalid parent list")
        require(isinstance(m.get("relations"), list) and len(m["relations"]) <= 256
                and all(isinstance(edge, dict) for edge in m["relations"]), "invalid relation list")
        objects = m.get("objects")
        require(isinstance(objects, list) and 1 <= len(objects) <= 64, "invalid object count")
        sizes = {}
        for obj in objects:
            require(isinstance(obj, dict) and is_digest(obj.get("sha256"))
                    and type(obj.get("bytes")) is int and 0 <= obj["bytes"] <= 256 * 1024,
                    "invalid object declaration")
            key_hash = obj["sha256"]
            require(sizes.setdefault(key_hash, obj["bytes"]) == obj["bytes"], "inconsistent object length")
        require(sum(sizes.values()) <= 3 * MIB, "payload exceeds size limit")
        require(files.keys() == {"objects/" + h for h in sizes}, "expected complete payload set")
        payloads = {}
        for h, expected_size in sizes.items():
            contents = member_bytes(archive, files["objects/" + h], expected_size)
            require(len(contents) == expected_size and digest(contents) == h, "object digest or length mismatch")
            payloads[h] = contents
        return Drop(digest(raw), digest(key), m, payloads)


def message(drop, slot):
    objects = drop.manifest["objects"]
    require(len(objects) == 1 and objects[0].get("slot") == slot, "unexpected message slot")
    value = parse_json(drop.payloads[objects[0]["sha256"]])
    required = {"operation", "request", "revision"}
    required |= {"inputs"} if slot == "request" else {"measured", "requestDrop"}
    require(isinstance(value, dict) and set(value) == required and value["operation"] == OPERATION
            and isinstance(value["request"], str) and re.fullmatch(r"[a-f0-9]{32}", value["request"])
            and is_digest(value["revision"]), "unsupported catalogue message")
    return value


def verify_exchange(request_file, reply_file, input_files, request_drop, responder):
    require(is_digest(request_drop) and is_digest(responder), "invalid expected trust values")
    require(1 <= len(input_files) <= 24, "expected 1 to 24 complete source drops")
    request = read_drop(request_file)
    reply = read_drop(reply_file)
    require(request.identifier == request_drop, "request does not match the expected manifest")
    require(reply.publisher == responder and reply.publisher != request.publisher, "unexpected responder")
    asked = message(request, "request")
    answered = message(reply, "answer")
    require(reply.manifest["parents"] == [request_drop] and answered["requestDrop"] == request_drop
            and answered["request"] == asked["request"] and answered["revision"] == asked["revision"],
            "answer is bound to another request or revision")
    rows = {}
    for path in input_files:
        source = read_drop(path)
        require(source.identifier not in rows, "duplicate input drop")
        rows[source.identifier] = {"drop": source.identifier, "payloads": sorted(source.payloads),
                                   "relations": len(source.manifest["relations"])}
    ids = sorted(rows)
    require(request.manifest["parents"] == ids, "different input publications")
    # JSON booleans and integers must remain distinct when comparing measurements.
    measured = json.dumps([rows[i] for i in ids], sort_keys=True)
    require(all(json.dumps(value, sort_keys=True) == measured
                for value in (asked["inputs"], answered["measured"])), "measurement differs from source bytes")
    return {"result": "VERIFIED", "operation": OPERATION, "inputs": len(ids),
            "requestDrop": request_drop, "replyDrop": reply.identifier, "revision": asked["revision"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.epilog = "Use --example alone to verify the signed synthetic example included here."
    parser.add_argument("--request-drop", required=True, help="SHA-256 of the expected request manifest")
    parser.add_argument("--responder", required=True, help="expected SHA-256 of the raw responder public key")
    parser.add_argument("request", type=Path)
    parser.add_argument("reply", type=Path)
    parser.add_argument("sources", type=Path, nargs="+")
    arguments = sys.argv[1:]
    try:
        if arguments == ["--example"]:
            example = Path(__file__).resolve().parent / "example"
            with (example / "pins.json").open("rb") as handle:
                raw = handle.read(1025)
            require(len(raw) <= 1024, "example trust file exceeds size limit")
            pins = parse_json(raw)
            require(isinstance(pins, dict) and is_digest(pins.get("requestDrop"))
                    and is_digest(pins.get("responder")), "invalid example trust values")
            arguments = ["--request-drop", pins["requestDrop"], "--responder", pins["responder"],
                         *(str(example / name) for name in ("request.hlv", "reply.hlv", "source.hlv"))]
        args = parser.parse_args(arguments)
        result = verify_exchange(args.request, args.reply, args.sources, args.request_drop, args.responder)
    except (ValueError, OSError, EOFError, RecursionError, zipfile.BadZipFile, zlib.error) as exc:
        print(f"REJECTED: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
