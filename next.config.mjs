const phpApi = process.env.PHP_API_URL ?? "http://127.0.0.1:8000";
const liveHostname = (() => { try { return new URL(phpApi).hostname; } catch { return ""; } })();

if (process.env.VERCEL === "1" && (!liveHostname || ["localhost", "127.0.0.1", "::1"].includes(liveHostname))) {
  throw new Error("PHP_API_URL must be the public HTTPS address of the deployed TPK PHP backend. Localhost cannot serve the live Vercel app.");
}
/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${phpApi}/api/:path*` },
      { source: "/uploads/:path*", destination: `${phpApi}/uploads/:path*` },
    ];
  },
};
