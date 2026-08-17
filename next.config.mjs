/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Ensure transpile for any modern packages if needed
  transpilePackages: ['lucide-react'],
};

export default nextConfig;
