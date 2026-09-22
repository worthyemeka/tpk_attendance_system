const phpApi = process.env.PHP_API_URL ?? "http://localhost:8000";
/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  async rewrites() { return [{ source: "/api/:path*", destination: `${phpApi}/api/:path*` }]; },
};
