import { bs } from "./util";

const ALG = { name: "AES-GCM", length: 256 } as const;

export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(ALG, true, ["encrypt", "decrypt"]);
}

export async function exportAesRaw(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

export async function importAesRaw(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", bs(raw), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

export async function aesEncrypt(
  key: CryptoKey,
  iv: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(data));
  return new Uint8Array(ct);
}

export async function aesDecrypt(
  key: CryptoKey,
  iv: Uint8Array,
  ct: Uint8Array
): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(ct));
  return new Uint8Array(pt);
}
