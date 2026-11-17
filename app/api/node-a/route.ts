import { NextRequest, NextResponse } from "next/server";
import { handleRelay, validatePacketShape } from "@/lib/relay/node";
import { rateLimit, clientIp } from "@/lib/relay/ratelimit";

export const runtime = "nodejs";

// Node A is the entry relay — it's the only one reached directly by browsers,
// so it carries CORS, rate limiting, and never delivers (null `next` is a
// malformed circuit).

const SEND_LIMIT = Number(process.env.SEND_LIMIT_PER_MIN || 10);

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`send:${ip}`, SEND_LIMIT, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many sends. Try again in a minute." },
        {
          status: 429,
          headers: { ...cors(), "Retry-After": String(Math.ceil(rl.resetMs / 1000)) },
        }
      );
    }

    const pkt = await req.json();
    if (!validatePacketShape(pkt)) {
      return NextResponse.json({ error: "bad packet shape" }, { status: 400, headers: cors() });
    }

    const origin = new URL(req.url).origin;
    const result = await handleRelay(
      {
        selfId: "a",
        privateKeyEnv: "NODE_A_PRIVATE_KEY",
        forwards: { b: process.env.NODE_B_URL || `${origin}/api/node-b` },
      },
      pkt,
      async () => {
        throw new Error("Node A received a packet with next=null; malformed circuit");
      }
    );

    return NextResponse.json({ accepted: true, ...result }, { headers: cors() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400, headers: cors() }
    );
  }
}
