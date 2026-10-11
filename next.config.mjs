/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-parse"],
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
  poweredByHeader: false,
};
export default nextConfig;
