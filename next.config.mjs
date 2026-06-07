/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Default is 1mb which would reject uploads before they reach our
      // 15 MB validation. Set to 16mb to give a small headroom.
      bodySizeLimit: '16mb',
    },
  },
};

export default nextConfig;
