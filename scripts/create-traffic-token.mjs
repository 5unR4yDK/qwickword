import nextEnv from "@next/env";
import { createProbeTrafficToken } from "../src/lib/traffic-classification.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const allowed = new Set([
  "founder",
  "developer",
  "contract",
  "smoke",
  "preview_fetch",
]);
const trafficClass = process.argv[2];
if (!allowed.has(trafficClass)) {
  console.error(
    "Usage: npm run traffic-token -- founder|developer|contract|smoke|preview_fetch"
  );
  process.exit(1);
}

const secret = process.env.IDENTITY_HMAC_SECRET?.trim();
if (!secret) {
  console.error("IDENTITY_HMAC_SECRET is not configured.");
  process.exit(1);
}

console.log(createProbeTrafficToken(trafficClass, secret));
