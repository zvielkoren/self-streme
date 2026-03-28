const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32ToBuffer(input) {
  const normalized = String(input || "")
    .trim()
    .toUpperCase()
    .replace(/=+$/g, "");

  if (!normalized || /[^A-Z2-7]/.test(normalized)) {
    throw new Error("Invalid base32 BTIH value");
  }

  let bits = 0;
  let value = 0;
  const output = [];

  for (const char of normalized) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) {
      throw new Error("Invalid base32 BTIH value");
    }

    value = (value << 5) | idx;
    bits += 5;

    while (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

export function extractInfoHash(input) {
  const value = String(input || "").trim();
  if (!value) {
    throw new Error("Missing info hash or magnet URI");
  }

  if (/^[a-fA-F0-9]{40}$/.test(value)) {
    return value.toLowerCase();
  }

  if (!value.toLowerCase().startsWith("magnet:")) {
    throw new Error("Invalid info hash format. Expected 40-char hex or magnet URI");
  }

  let xt = null;
  try {
    const magnetUrl = new URL(value);
    xt = magnetUrl.searchParams.get("xt");
  } catch {
    const match = value.match(/[?&]xt=([^&]+)/i);
    xt = match ? decodeURIComponent(match[1]) : null;
  }

  const btihMatch = xt?.match(/^urn:btih:([A-Za-z0-9]+)$/i);
  if (!btihMatch) {
    throw new Error("Invalid magnet URI: missing or invalid xt=urn:btih parameter");
  }

  const btih = btihMatch[1];
  if (/^[a-fA-F0-9]{40}$/.test(btih)) {
    return btih.toLowerCase();
  }

  if (/^[A-Za-z2-7]{32}$/.test(btih)) {
    const decoded = decodeBase32ToBuffer(btih);
    if (decoded.length !== 20) {
      throw new Error("Invalid base32 BTIH length");
    }
    return decoded.toString("hex").toLowerCase();
  }

  throw new Error("Invalid BTIH value. Expected 40-char hex or 32-char base32");
}

export function tryExtractInfoHash(input) {
  try {
    return extractInfoHash(input);
  } catch {
    return null;
  }
}
