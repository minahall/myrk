const RSA_GEN = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
} as const;

const RSA_IMPORT = { name: "RSA-OAEP", hash: "SHA-256" } as const;

export async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(RSA_GEN, true, ["encrypt", "decrypt"]) as Promise<CryptoKeyPair>;
}

export async function exportJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

export async function importPublicJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, RSA_IMPORT, true, ["encrypt"]);
}

export async function importPrivateJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, RSA_IMPORT, true, ["decrypt"]);
}

export async function rsaWrap(publicKey: CryptoKey, aesRaw: Uint8Array): Promise<Uint8Array> {
  const ct = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, aesRaw);
  return new Uint8Array(ct);
}

export async function rsaUnwrap(privateKey: CryptoKey, wrapped: Uint8Array): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, wrapped);
  return new Uint8Array(pt);
}
