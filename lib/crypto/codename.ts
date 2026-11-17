import { te, toBase64, randomBytes } from "./util";

// 50 words × 6 slots → log2(50^6) ≈ 33.8 bits of entropy.
// PBKDF2-SHA-256 at 310 000 iterations makes an offline guess expensive;
// online guesses are additionally rate-limited server-side (Session 7).
export const WORDS = [
  "pale", "lantern", "ember", "hollow", "thorn", "raven", "moss", "bell", "ash", "tallow",
  "marsh", "veil", "cinder", "wick", "fen", "crow", "sedge", "bramble", "dusk", "knell",
  "briar", "mire", "hearth", "quill", "shale", "silt", "tether", "vane", "wither", "yarrow",
  "cairn", "cove", "gull", "harrow", "ivy", "larch", "nettle", "owl", "peat", "rime",
  "slate", "tarn", "wren", "yew", "bone", "coal", "drift", "fern", "glen", "hush",
];

const DEFAULT_WORDS = 6;
const PBKDF2_ITER = 310_000;
const SALT_MAILBOX = te.encode("myrk/v1/mailbox");
const SALT_REPLY = te.encode("myrk/v1/reply");

export function generateCodename(wordCount = DEFAULT_WORDS): string {
  const bytes = randomBytes(wordCount * 2);
  const dv = new DataView(bytes.buffer);
  return Array.from({ length: wordCount }, (_, i) => {
    const r = dv.getUint16(i * 2, false);
    return WORDS[r % WORDS.length];
  }).join(" ");
}

export function normalizeCodename(codename: string): string {
  return codename.trim().toLowerCase().replace(/\s+/g, " ");
}

async function baseKey(codename: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    te.encode(normalizeCodename(codename)),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
}

export async function deriveMailbox(
  codename: string
): Promise<{ mailboxId: string; replyKey: CryptoKey }> {
  const base = await baseKey(codename);
  const [idBits, replyKey] = await Promise.all([
    crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: SALT_MAILBOX, iterations: PBKDF2_ITER, hash: "SHA-256" },
      base,
      256
    ),
    crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: SALT_REPLY, iterations: PBKDF2_ITER, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    ),
  ]);
  return { mailboxId: toBase64(new Uint8Array(idBits)), replyKey };
}
