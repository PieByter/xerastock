/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@stock-analyst/shared",
    "@stock-analyst/engine",
    "@stock-analyst/db",
  ],
};

export default nextConfig;
