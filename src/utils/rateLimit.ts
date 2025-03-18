import rateLimit from "express-rate-limit";
import fs from "fs/promises";
import path from "path";

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
    const rateLimitPath = path.join(process.cwd(), "ratelimit.json");
    await fs.access(rateLimitPath);
    const data = await fs.readFile(rateLimitPath, "utf8");
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