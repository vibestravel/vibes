import { NextResponse, type NextRequest } from "next/server";

// Cheap gate: no session cookie → login. Pages still verify the session fully on the server.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/") || pathname.startsWith("/_next")) return NextResponse.next();
  if (!req.cookies.get("vibes_session")) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
