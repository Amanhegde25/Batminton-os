import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const authed = req.cookies.has("bcos_session");
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"]
};
