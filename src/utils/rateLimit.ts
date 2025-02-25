import rateLimit from "express-rate-limit";
import fs from "fs/promises";

interface RateLimitOptions {
  windowMs: number;
  limit: number;
  message?: string;
}

interface RateLimitConfig {
  [endpoint: string]: RateLimitOptions;
}

export const loadRateLimitConfig = async (): Promise<RateLimitConfig> => {
  try {
    await fs.access(`${process.env.MAILCONNECT_ROOT_DIR}/ratelimit.json`);
    const data = await fs.readFile(`${process.env.MAILCONNECT_ROOT_DIR}/ratelimit.json`, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("[!] Error loading ratelimit config:\n", err);
    process.exit(1);
  }
};

export const createLimiter = (options: RateLimitOptions) =>
  rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    message: options.message || "Too many requests, please try again later.",
  });