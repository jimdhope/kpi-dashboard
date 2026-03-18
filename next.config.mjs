
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
  // Required for Genkit flow server actions, might be needed if interacting with Firebase Functions via actions
  experimental: {
    serverActions: {
        // Add your Firebase project's auth domain if needed for server actions interacting with Firebase
        // Ensure NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is correctly set in your environment
       allowedOrigins: [process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || ""].filter(Boolean),
    },
  },
  async redirects() {
    return [
      // Redirect old admin routes to new competitions routes
      {
        source: '/admin/log-achievements',
        destination: '/competitions/log',
        permanent: false,
      },
      {
        source: '/admin/daily-scores',
        destination: '/competitions/scores',
        permanent: false,
      },
      {
        source: '/admin/rps-scores',
        destination: '/competitions/rps',
        permanent: false,
      },
      {
        source: '/admin/competitions',
        destination: '/competitions/setup',
        permanent: false,
      },
      {
        source: '/admin/pod-targets',
        destination: '/competitions/targets',
        permanent: false,
      },
      {
        source: '/admin/teams',
        destination: '/competitions/teams',
        permanent: false,
      },
      {
        source: '/admin/leaderboard',
        destination: '/competitions/leaderboard',
        permanent: false,
      },
      {
        source: '/admin/certificates',
        destination: '/competitions/certificates',
        permanent: false,
      },
      {
        source: '/admin/stats',
        destination: '/competitions/dashboard',
        permanent: false,
      },
      // Redirect old admin routes to new trackers routes
      {
        source: '/admin/trackers/setup',
        destination: '/trackers/setup',
        permanent: false,
      },
      {
        source: '/admin/trackers/log',
        destination: '/trackers/log',
        permanent: false,
      },
      // Redirect old admin routes to new performance routes
      {
        source: '/admin/additional-kpis',
        destination: '/performance/kpis',
        permanent: false,
      },
      {
        source: '/admin/additional-scores',
        destination: '/performance/log',
        permanent: false,
      },
      {
        source: '/admin/additional-leaderboard',
        destination: '/performance/leaderboard',
        permanent: false,
      },
      {
        source: '/admin/kpi-breakdown',
        destination: '/performance/breakdown',
        permanent: false,
      },
      {
        source: '/admin/performance-charts',
        destination: '/performance/charts',
        permanent: false,
      },
      // Redirect old admin routes to new settings routes
      {
        source: '/admin/campaigns',
        destination: '/settings/campaigns',
        permanent: false,
      },
      {
        source: '/admin/pods',
        destination: '/settings/pods',
        permanent: false,
      },
      {
        source: '/admin/users',
        destination: '/settings/users',
        permanent: false,
      },
      {
        source: '/admin/message-of-the-day',
        destination: '/settings/dashboard',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
