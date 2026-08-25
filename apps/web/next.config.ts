import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const monorepoRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const nextConfig: NextConfig = {
  transpilePackages: ["@spec-hub/shared-schemas", "@spec-hub/codex-gate"],
};

export default nextConfig;

/** Monorepo root — used by server code to locate .env / corpus. */
export const WEB_MONOREPO_ROOT = monorepoRoot;
