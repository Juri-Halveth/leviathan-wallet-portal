# SPDX-License-Identifier: MIT
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import zipfile

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from verify_exchange import InvalidExchange, verify_exchange


EXAMPLE = Path(__file__).resolve().parent / "example"
PINS = json.loads((EXAMPLE / "pins.json").read_bytes())
REQUEST = EXAMPLE / "request.hlv"
REPLY = EXAMPLE / "reply.hlv"
SOURCE = EXAMPLE / "source.hlv"


def verify(reply=REPLY, sources=(SOURCE,), request_drop=PINS["requestDrop"], responder=PINS["responder"]):
    return verify_exchange(REQUEST, reply, sources, request_drop, responder)


def members(path):
    with zipfile.ZipFile(path) as archive:
        return {name: archive.read(name) for name in archive.namelist()}


def write_members(path, data):
    with zipfile.ZipFile(path, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, contents in data.items():
            archive.writestr(name, contents)
    return path


def signed_variant(target, alter):
    data = members(REPLY)
    manifest = json.loads(data["manifest.json"])
    obj = manifest["objects"][0]
    message = json.loads(data.pop("objects/" + obj["sha256"]))
    alter(manifest, message)
    key = Ed25519PrivateKey.generate()
    raw_key = key.public_key().public_bytes_raw()
    manifest["public_key"] = raw_key.hex()
    raw = json.dumps(message).encode("utf8")
    obj.update(sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw))
    data["objects/" + obj["sha256"]] = raw
    data["manifest.json"] = json.dumps(manifest).encode("utf8")
    data["ed25519.sig"] = key.sign(data["manifest.json"])
    return write_members(target, data), hashlib.sha256(raw_key).hexdigest()


class ExchangeTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.target = Path(temporary.name) / "sample.hlv"

    def test_original_station_pair(self):
        result = verify()
        self.assertEqual((result["result"], result["inputs"]), ("VERIFIED", 1))
        self.assertEqual(result["replyDrop"], hashlib.sha256(members(REPLY)["manifest.json"]).hexdigest())

    def test_requires_expected_request(self):
        with self.assertRaisesRegex(InvalidExchange, "expected manifest"):
            verify(request_drop="0"*64)

    def test_requires_expected_responder(self):
        with self.assertRaisesRegex(InvalidExchange, "unexpected responder"):
            verify(responder="0"*64)

    def test_modified_signature(self):
        data = members(REPLY)
        sig = bytearray(data["ed25519.sig"])
        sig[0] ^= 1
        data["ed25519.sig"] = bytes(sig)
        with self.assertRaisesRegex(InvalidExchange, "signature mismatch"):
            verify(reply=write_members(self.target, data))

    def test_changed_source_byte(self):
        data = members(SOURCE)
        name = next(key for key in data if key.startswith("objects/"))
        data[name] = bytes([data[name][0] ^ 1]) + data[name][1:]
        with self.assertRaisesRegex(InvalidExchange, "digest or length mismatch"):
            verify(sources=[write_members(self.target, data)])

    def test_requires_all_source_bytes(self):
        data = members(SOURCE)
        del data[next(key for key in data if key.startswith("objects/"))]
        with self.assertRaisesRegex(InvalidExchange, "complete payload set"):
            verify(sources=[write_members(self.target, data)])

    def test_no_duplicate_input(self):
        with self.assertRaisesRegex(InvalidExchange, "duplicate input drop"):
            verify(sources=[SOURCE, SOURCE])

    def test_size_checked_before_zip(self):
        self.target.write_bytes(b"x" * (4 * 1024**2 + 1))
        with self.assertRaisesRegex(InvalidExchange, "size limit"):
            verify(reply=self.target)

    def test_signed_answer_for_another_challenge(self):
        reply, pin = signed_variant(self.target, lambda m, v: v.update(request="0"*32))
        with self.assertRaisesRegex(InvalidExchange, "another request"):
            verify(reply=reply, responder=pin)

    def test_signed_answer_for_another_parent(self):
        reply, pin = signed_variant(self.target, lambda m, v: m.update(parents=[]))
        with self.assertRaisesRegex(InvalidExchange, "another request"):
            verify(reply=reply, responder=pin)

    def test_signed_reply_with_false_measurement(self):
        reply, pin = signed_variant(self.target, lambda m, v: v["measured"][0].update(payloads=[]))
        with self.assertRaisesRegex(InvalidExchange, "measurement differs"):
            verify(reply=reply, responder=pin)

    def test_boolean_is_not_a_relation_count(self):
        reply, pin = signed_variant(self.target, lambda m, v: v["measured"][0].update(relations=False))
        with self.assertRaisesRegex(InvalidExchange, "measurement differs"):
            verify(reply=reply, responder=pin)


if __name__ == "__main__":
    unittest.main()
