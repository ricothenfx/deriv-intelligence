import { config } from "dotenv";

config({ path: "../../.env" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@deriv-intel/core", "@deriv-intel/llm", "@deriv-intel/connectors"],
  experimental: {
    serverComponentsExternalPackages: ["pg", "pdfkit", "bullmq", "ioredis"],
  },
};

export default nextConfig;
