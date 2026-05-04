import type { NextConfig } from "next";

const staticIpfs = process.env.STATIC_IPFS_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(staticIpfs
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        images: {
          remotePatterns: [
            {
              protocol: "https",
              hostname: "api.qrserver.com",
              pathname: "/**",
            },
          ],
        },
      }),
  transpilePackages: [
    "@cosmjs/proto-signing",
    "@cosmjs/crypto",
    "@cosmjs/amino",
  ],
};

export default nextConfig;
