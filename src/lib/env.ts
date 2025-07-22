// env.ts

/**
 * Type for environment variables
 */
export type Env = Record<string, string | undefined>;

/**
 * Platform-agnostic environment variable source
 */
declare const __APP_ENV__: Env;
declare const Deno: any;
declare const process: { env: Env };

/**
 * Safely access environment variables across runtimes
 */
const getEnv = (): Env => {
  // Bun and Node.js
  if (typeof process !== 'undefined' && process?.env) {
    return process.env;
  }

  // Deno
  if (typeof Deno !== 'undefined' && Deno?.env) {
    return Deno.env.toObject();
  }

  // Cloudflare Workers (globalThis.__APP_ENV__ will be set by the platform)
  if (typeof __APP_ENV__ !== 'undefined') {
    return __APP_ENV__;
  }

  // Fallback: empty object
  return {};
};

/**
 * Exported environment object
 */
export const ENV = getEnv();