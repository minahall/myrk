import { importPrivateJwk } from "@/lib/crypto/rsa";
import { peelOnion, HybridPacket } from "@/lib/crypto/onion";

export type RelayConfig = {
  selfId: string;                     // 'a' | 'b' | 'c'
  privateKeyEnv: string;              // env var holding the node's private JWK (JSON string)
  forwards: Record<string, string>;   // map nextId -> next relay's POST URL
};

// Module-level cache: in a warm serverless instance we import the JWK once.
const keyCache = new Map<string, Promise<CryptoKey>>();

async function loadPrivateKey(envName: string): Promise<CryptoKey> {
  const cached = keyCache.get(envName);
  if (cached) return cached;
  const raw = process.env[envName];
  if (!raw) throw new Error(`${envName} is not set`);
  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(raw) as JsonWebKey;
  } catch {
    throw new Error(`${envName} is not valid JSON`);
  }
  const p = importPrivateJwk(jwk);
  keyCache.set(envName, p);
  return p;
}

export type RelayResult =
  | { stage: string; forwardedTo: string }
  | { stage: string; delivered: true };

/**
 * Peels one onion layer. If there is a next hop, POSTs the inner packet there.
 * If `next` is null, hands the inner (sealed-for-journalist) packet to `onDeliver`.
 * Returns a tiny JSON-serializable result; never includes payload bytes.
 */
export async function handleRelay(
  config: RelayConfig,
  outer: HybridPacket,
  onDeliver: (inner: HybridPacket) => Promise<void>
): Promise<RelayResult> {
  const key = await loadPrivateKey(config.privateKeyEnv);
  const { next, body } = await peelOnion(key, outer);

  if (next === null) {
    await onDeliver(body);
    return { stage: config.selfId, delivered: true };
  }

  const url = config.forwards[next];
  if (!url) throw new Error(`relay ${config.selfId}: no forward URL for next=${next}`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`relay ${config.selfId}: forward to ${next} failed HTTP ${res.status} ${txt.slice(0, 120)}`);
  }
  return { stage: config.selfId, forwardedTo: next };
}

export function validatePacketShape(p: unknown): p is HybridPacket {
  return (
    !!p &&
    typeof p === "object" &&
    typeof (p as HybridPacket).wk === "string" &&
    typeof (p as HybridPacket).iv === "string" &&
    typeof (p as HybridPacket).ct === "string"
  );
}
