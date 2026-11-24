/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Outra pasta de build permite um 2º `next dev` em paralelo (ex.: um ligado aos emuladores do Firebase).
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

module.exports = nextConfig;
