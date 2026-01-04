import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// paths that REQUIRES membership
const protectedRoutes = ["/fuel", "/sensei", "/gyms"];

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  const mockUser = {
    trialActive: true,
    trialEnds: new Date(Date.now() + 86400000), // 1 day left
    membership: "none",
  };

  const trialExpired =
    mockUser.trialActive && mockUser.trialEnds.getTime() < Date.now();

  const needsPaywall = protectedRoutes.some((p) => pathname.startsWith(p));

  if (needsPaywall) {
    if (!mockUser.trialActive || trialExpired) {
      url.pathname = "/membership";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/fuel/:path*", "/sensei/:path*", "/gyms/:path*"],
};
