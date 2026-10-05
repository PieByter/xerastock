/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Output standalone dipakai image Docker (runtime minimal tanpa node_modules penuh).
  output: "standalone",
  transpilePackages: [
    "@stock-analyst/shared",
    "@stock-analyst/engine",
    "@stock-analyst/db",
  ],
};

export default nextConfig;
