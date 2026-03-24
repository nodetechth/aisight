import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const auth = req.headers.get("authorization");
  const expected =
    "Basic " +
    Buffer.from(
      `${process.env.ADMIN_USER}:${process.env.ADMIN_PASSWORD}`
    ).toString("base64");

  if (auth !== expected) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
