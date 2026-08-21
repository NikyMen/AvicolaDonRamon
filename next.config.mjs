/** @type {import('next').NextConfig} */
const nextConfig = {
  // Genera un build autocontenido ideal para desplegar en un VPS / Docker.
  // Solo se activa en el build de Docker (BUILD_STANDALONE=true), porque en
  // Windows + pnpm el copiado de "standalone" requiere permisos de symlink.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  reactStrictMode: true,
  experimental: {
    // Las imágenes de producto/oferta se comprimen en el browser a ~600 KB
    // (ver src/lib/image-client.ts) antes de subirlas por server action; el
    // límite explícito evita depender del default de Next (1 MB) que quedó
    // muy justo y causó cargas fallidas en producción sin motivo aparente.
    serverActions: { bodySizeLimit: "2mb" },
  },
  async rewrites() {
    return {
      // `next start` solo conoce los archivos de /public que existían al
      // arrancar el proceso: una imagen subida en caliente devuelve 404 hasta
      // el próximo restart. Forzamos que TODA request a /uploads/products/*
      // pase por la ruta dinámica que lee el disco en vivo (ver
      // src/app/api/uploads/products/[filename]/route.ts), en vez de dejar
      // que Next intente resolverla como estático primero.
      beforeFiles: [
        {
          source: "/uploads/products/:filename",
          destination: "/api/uploads/products/:filename",
        },
      ],
    };
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
