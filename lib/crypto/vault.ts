import { te, toBase64, fromBase64, randomBytes, bs } from "./util";

// Passphrase-sealed envelope for stashing the journalist's private JWK in
// localStorage. Not recoverable if the passphrase is lost.

const SALT_LEN = 16;
const ITER = 310_000;
const VERSION = 1;

async function derive(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    bs(te.encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: bs(salt), iterations: ITER, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function sealWithPassphrase(plaintext: string, passphrase: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(12);
  const key = await derive(passphrase, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bs(iv) },
    key,
    bs(te.encode(plaintext))
  );
  return JSON.stringify({
    v: VERSION,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ct)),
  });
}

export async function openWithPassphrase(sealed: string, passphrase: string): Promise<string> {
  const o = JSON.parse(sealed) as { v: number; salt: string; iv: string; ct: string };
  if (o.v !== VERSION) throw new Error("unsupported vault version");
  const key = await derive(passphrase, fromBase64(o.salt));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bs(fromBase64(o.iv)) },
    key,
    bs(fromBase64(o.ct))
  );
  return new TextDecoder().decode(pt);
}
