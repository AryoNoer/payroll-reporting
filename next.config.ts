/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '500mb',
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
}

module.exports = nextConfig