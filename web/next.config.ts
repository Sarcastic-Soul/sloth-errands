import type { NextConfig } from "next";
import { resolve } from "node:path";
import { config } from "dotenv";

// Secrets live in week3/.env, two folders up, so they never sit inside the repo
config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  // Keeps the Next badge out of the demo recording
  devIndicators: false,
  // The Temporal client loads gRPC and protobuf at runtime, so keep it out of the bundle
  serverExternalPackages: ["@temporalio/client", "@temporalio/common", "@temporalio/proto"],
  turbopack: {
    // Lets the app import the chore list from ../src
    root: resolve(process.cwd(), ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
