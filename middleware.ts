// middleware.ts (root directory)
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/uploads/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};