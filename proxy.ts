// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// ✅ FIX: Function name harus 'proxy' bukan 'middleware'
export async function proxy(request: NextRequest) {
  // ✅ FIX: Skip proxy untuk POST requests dengan file upload
  // Karena proxy bisa "mengganggu" request body yang besar
  if (request.method === "POST" && request.nextUrl.pathname === "/api/uploads") {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });

  // If not authenticated, redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    // Use relative path for callbackUrl to avoid 0.0.0.0 or internal IP issues
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // ✅ Pastikan return NextResponse.next() tanpa modifikasi body
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    // "/api/uploads/:path*",
    "/api/reports/:path*",
  ],
};