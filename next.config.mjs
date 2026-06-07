// Versi build: pakai git SHA dari Vercel bila ada, jika tidak pakai timestamp.
// Di-inline ke bundle saat build (NEXT_PUBLIC_* terbaca di server & client).
const buildSha =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  process.env.NEXT_PUBLIC_APP_VERSION ||
  'dev';
const buildTime = new Date().toISOString();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint is run separately; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: buildSha,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
};

export default nextConfig;
