/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  output: 'standalone',
  reactStrictMode: true,
};

export default nextConfig;
