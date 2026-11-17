import { NextRequest, NextResponse } from "next/server";

// Each deployment carries the same compiled code but exposes only the role it's
// supposed to play. NODE_ROLE = 'a' | 'b' | 'c' | 'frontend'. Unset → local dev
// (all relay routes live, so one `npm run dev` can play every role).

const RELAY_PREFIX = "/api/node-";

export function middleware(req: NextRequest) {
  const role = process.env.NODE_ROLE;
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith(RELAY_PREFIX)) return NextResponse.next();
  if (!role) return NextResponse.next();
  const expected = `${RELAY_PREFIX}${role}`;
  if (pathname === expected || pathname.startsWith(`${expected}/`)) return NextResponse.next();
  return new NextResponse("Not Found", { status: 404 });
}

export const config = {
  matcher: ["/api/node-:path*"],
};
