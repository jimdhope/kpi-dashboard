
/** @type {import('next').NextConfig} */
const nextConfig = {
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
  experimental: {
    serverActions: {
        // Add your Firebase project's auth domain if needed for server actions interacting with Firebase
        // Ensure NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is correctly set in your environment
       allowedOrigins: [process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || ""].filter(Boolean),
    },
  },
  async redirects() {
    return [
      // Redirect old competition routes to new competition routes
      {
        source: '/admin/competitions',
        destination: '/competitions',
        permanent: false,
      },
      {
        source: '/admin/competitions/manage',
        destination: '/competitions/manage',
        permanent: false,
      },
      {
        source: '/admin/competitions/manage/wizard',
        destination: '/competitions/manage/wizard',
        permanent: false,
      },
      {
        source: '/admin/competitions/certificates',
        destination: '/competitions/certificates',
        permanent: false,
      },
      // Redirect old routes to new competition routes
      {
        source: '/competitions/setup',
        destination: '/competitions/manage',
        permanent: false,
      },
      {
        source: '/competitions/setup/add',
        destination: '/competitions/manage/wizard',
        permanent: false,
      },
      {
        source: '/competitions/setup/edit/:id',
        destination: '/competitions/manage/wizard?edit=:id',
        permanent: false,
      },
      {
        source: '/competitions/rps',
        destination: '/mini-games/rps',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
