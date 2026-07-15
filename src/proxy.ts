// Next.js discovers Proxy beside a `src/app` tree. Keep the implementation at
// the repository boundary so security policy has one source of truth, while
// declaring the matcher here so Next can analyse it statically at build time.
export { proxy } from "@/server/security/request-proxy";

export const config = {
  matcher: [
    "/admin/:path*",
    "/agent/:path*",
    "/settings/:path*",
    "/dashboard/:path*",
    "/competitions/:path*",
    "/performance/:path*",
    "/directory/:path*",
    "/knowledge-base/:path*",
    "/reports/:path*",
    "/mini-games/:path*",
    "/tools/:path*",
    "/team-leader/:path*",
    "/pod-manager/:path*",
    "/call-flow/:path*",
    "/meter-reading-guide/:path*",
    "/api/:path*",
  ],
};
