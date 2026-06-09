/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Default is 1mb which would reject uploads before they reach our
      // 15 MB validation. Set to 16mb to give a small headroom.
      bodySizeLimit: '16mb',
    },
    // Keep pdf-parse and pdfjs-dist as native Node.js requires so Vercel
    // doesn't bundle them — the worker file (pdf.worker.mjs) must stay
    // resolvable relative to the package root at runtime.
    serverComponentsExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  },
};

export default nextConfig;
