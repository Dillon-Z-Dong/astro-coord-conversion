/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    basePath: process.env.NODE_ENV === 'production' ? '/astro-coord-conversion' : '',
    images: {
      unoptimized: true,
    },
  }
  
  module.exports = nextConfig