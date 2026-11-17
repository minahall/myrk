import { NextRequest, NextResponse } from "next/server";
import { handleRelay, validatePacketShape } from "@/lib/relay/node";

export const runtime = "nodejs";

// Node B is the middle relay — only ever reached server-to-server from Node A.
// No CORS, no delivery.

export async function POST(req: NextRequest) {
  try {
    const pkt = await req.json();
    if (!validatePacketShape(pkt)) {
      return NextResponse.json({ error: "bad packet shape" }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    const result = await handleRelay(
      {
        selfId: "b",
        privateKeyEnv: "NODE_B_PRIVATE_KEY",
        forwards: { c: process.env.NODE_C_URL || `${origin}/api/node-c` },
      },
      pkt,
      async () => {
        throw new Error("Node B received a packet with next=null; malformed circuit");
      }
    );

    return NextResponse.json({ accepted: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
