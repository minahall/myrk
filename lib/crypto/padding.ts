// Fixed-size cells defeat message-length correlation attacks.
// Format: [4-byte big-endian length] [payload] [random fill to CELL_BYTES].
// Random fill ensures that an adversary who later obtains the cell key
// still cannot distinguish short tips from long ones by trailing zeros.

export const CELL_BYTES = 2048;
const HEADER = 4;

export function pad(payload: Uint8Array, cellSize = CELL_BYTES): Uint8Array {
  if (payload.length + HEADER > cellSize) {
    throw new Error(`payload ${payload.length}B exceeds cell ${cellSize - HEADER}B`);
  }
  const out = new Uint8Array(cellSize);
  new DataView(out.buffer).setUint32(0, payload.length, false);
  out.set(payload, HEADER);
  crypto.getRandomValues(out.subarray(HEADER + payload.length));
  return out;
}

export function unpad(cell: Uint8Array): Uint8Array {
  const dv = new DataView(cell.buffer, cell.byteOffset, cell.byteLength);
  const len = dv.getUint32(0, false);
  if (len > cell.length - HEADER) throw new Error("bad cell length");
  return cell.slice(HEADER, HEADER + len);
}
