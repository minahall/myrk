import { NextRequest, NextResponse } from "next/server";
import { handleRelay, validatePacketShape } from "@/lib/relay/node";
import { adminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Node C is the exit relay. It peels the last layer and inserts the
// sealed-for-journalist packet into the tips table using the service_role key.

export async function POST(req: NextRequest) {
  try {
    const pkt = await req.json();
    if (!validatePacketShape(pkt)) {
      return NextResponse.json({ error: "bad packet shape" }, { status: 400 });
    }

    const result = await handleRelay(
      {
        selfId: "c",
        privateKeyEnv: "NODE_C_PRIVATE_KEY",
        forwards: {},
      },
      pkt,
      async (inner) => {
        const { error } = await adminSupabase().from("tips").insert({ packet: inner });
        if (error) throw new Error(`tips insert: ${error.message}`);
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
