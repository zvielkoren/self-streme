import test from "node:test";
import assert from "node:assert/strict";
import { extractInfoHash, tryExtractInfoHash } from "../src/utils/infoHash.js";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeHexToBase32(hex) {
  const buffer = Buffer.from(hex, "hex");
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

test("extractInfoHash supports raw hex and magnet hex", () => {
  const hex = "0123456789abcdef0123456789abcdef01234567";
  assert.equal(extractInfoHash(hex.toUpperCase()), hex);
  assert.equal(extractInfoHash(`magnet:?xt=urn:btih:${hex}`), hex);
});

test("extractInfoHash supports magnet base32 BTIH", () => {
  const hex = "89abcdef0123456789abcdef0123456789abcdef";
  const base32 = encodeHexToBase32(hex);
  assert.equal(extractInfoHash(`magnet:?xt=urn:btih:${base32}`), hex);
});

test("extractInfoHash rejects invalid values with explicit errors", () => {
  assert.throws(
    () => extractInfoHash("magnet:?xt=urn:btih:invalid"),
    /Invalid BTIH value/i,
  );
  assert.equal(tryExtractInfoHash("not-a-hash"), null);
});
