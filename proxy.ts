// middleware.ts (root directory)
export { default } from "next-auth/middleware";

export function proxy () {
  return {
    matcher: [
      "/dashboard/:path*",
      "/uploads/:path*",
      "/reports/:path*",
      "/settings/:path*",
    ],
  };
}
