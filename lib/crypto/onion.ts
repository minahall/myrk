import { aesEncrypt, aesDecrypt, generateAesKey, exportAesRaw, importAesRaw } from "./aes";
import { rsaWrap, rsaUnwrap, importPublicJwk } from "./rsa";
import { toBase64, fromBase64, te, td, randomBytes } from "./util";
import { pad, unpad } from "./padding";

export type Hop = { nodeId: string; publicKey: JsonWebKey };

// Wire format for one hybrid-encrypted packet.
export type HybridPacket = { wk: string; iv: string; ct: string };

// Plaintext of a decrypted layer. `next` is the nodeId to forward to, or null
// at the final hop (deliver `body` to the journalist's dropbox).
type Layer = { next: string | null; body: string }; // body: base64 of inner HybridPacket JSON bytes

async function sealTo(recipientJwk: JsonWebKey, plaintext: Uint8Array): Promise<HybridPacket> {
  const pub = await importPublicJwk(recipientJwk);
  const aesKey = await generateAesKey();
  const aesRaw = await exportAesRaw(aesKey);
  const iv = randomBytes(12);
  const ct = await aesEncrypt(aesKey, iv, plaintext);
  const wk = await rsaWrap(pub, aesRaw);
  return { wk: toBase64(wk), iv: toBase64(iv), ct: toBase64(ct) };
}

export async function openSealed(privateKey: CryptoKey, pkt: HybridPacket): Promise<Uint8Array> {
  const aesRaw = await rsaUnwrap(privateKey, fromBase64(pkt.wk));
  const aesKey = await importAesRaw(aesRaw);
  return aesDecrypt(aesKey, fromBase64(pkt.iv), fromBase64(pkt.ct));
}

const packetBytes = (p: HybridPacket): Uint8Array => te.encode(JSON.stringify(p));
const packetFromBytes = (b: Uint8Array): HybridPacket => JSON.parse(td.decode(b)) as HybridPacket;

export async function wrapOnion(
  tipPlaintext: Uint8Array,
  journalistKey: JsonWebKey,
  hops: Hop[]
): Promise<HybridPacket> {
  if (hops.length < 1) throw new Error("need at least one hop");

  // Innermost: pad the tip to a fixed cell, then seal to the journalist.
  let inner: HybridPacket = await sealTo(journalistKey, pad(tipPlaintext));
  let nextNodeId: string | null = null;

  // Walk hops in reverse so the first hop (A) ends up as the outermost layer.
  for (let i = hops.length - 1; i >= 0; i--) {
    const layer: Layer = { next: nextNodeId, body: toBase64(packetBytes(inner)) };
    inner = await sealTo(hops[i].publicKey, te.encode(JSON.stringify(layer)));
    nextNodeId = hops[i].nodeId;
  }
  return inner;
}

export type Peeled = { next: string | null; body: HybridPacket };

export async function peelOnion(privateKey: CryptoKey, pkt: HybridPacket): Promise<Peeled> {
  const layerBytes = await openSealed(privateKey, pkt);
  const layer = JSON.parse(td.decode(layerBytes)) as Layer;
  return { next: layer.next, body: packetFromBytes(fromBase64(layer.body)) };
}

// Journalist-side final decrypt: unseal the inner packet and strip padding.
export async function openForJournalist(
  journalistPrivate: CryptoKey,
  pkt: HybridPacket
): Promise<Uint8Array> {
  const padded = await openSealed(journalistPrivate, pkt);
  return unpad(padded);
}
