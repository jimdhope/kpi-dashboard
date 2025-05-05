
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Required for Genkit flow server actions, might be needed if interacting with Firebase Functions via actions
  experimental: {
    serverActions: {
        // Add your Firebase project's auth domain if needed for server actions interacting with Firebase
        // Ensure NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is correctly set in your environment
       allowedOrigins: [process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || ""].filter(Boolean) as string[],
    },
  },
};

export default nextConfig;
