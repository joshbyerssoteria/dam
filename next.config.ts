import type { NextConfig } from "next";

const s3PublicBaseUrl = process.env.S3_PUBLIC_BASE_URL;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase storage-hosted previews (if used)
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      // S3 originals/variants
      ...(s3PublicBaseUrl
        ? [
            {
              protocol: "https" as const,
              hostname: new URL(s3PublicBaseUrl).hostname,
            },
          ]
        : [
            {
              protocol: "https" as const,
              hostname: "*.amazonaws.com",
            },
          ]),
    ],
  },
  serverExternalPackages: ["sharp", "archiver", "mupdf"],
};

export default nextConfig;
