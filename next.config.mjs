/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Default is 1mb which would reject uploads before they reach our
      // 15 MB validation. Set to 16mb to give a small headroom.
      bodySizeLimit: '16mb',
    },
    // Keep pdf2json as a native Node.js require so webpack does not try to
    // bundle its self-contained pdfjs-dist bundle a second time.
    serverComponentsExternalPackages: ['pdf2json'],
  },
};

export default nextConfig;
