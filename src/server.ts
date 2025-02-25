import express from "express"
import fs from "fs/promises"
import rateLimit from "express-rate-limit"
import Docker from "dockerode"
import validator from "validator"
import PasswordValidator from "password-validator"
import { accounts, cacheInfo } from "./db/schema"
import { eq } from "drizzle-orm"
import type { Request, Response } from "express"
import { drizzle } from 'drizzle-orm/bun-sqlite';

interface RateLimitOptions {
  windowMs: number
  limit: number
  message?: string
}

interface RateLimitConfig {
  [endpoint: string]: RateLimitOptions
}

interface Account {
  email: string
  used: string
  capacity: string
  percentage: string
}

const docker = new Docker({ socketPath: "/var/run/docker.sock" })
const app = express()
const db = drizzle(process.env.DB_FILE_NAME!);
const container = docker.getContainer("mailserver");
app.use(express.json())

let rateLimitConfig: RateLimitConfig = {}
;(async () => {
  try {
    const data = await fs.readFile("/app/ratelimit.json", "utf8")
    rateLimitConfig = JSON.parse(data)
  } catch (err) {
    console.error("Error loading rate limit config:", err)
  }
})()

const createLimiter = (options: RateLimitOptions) =>
  rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    message: options.message || "Too many requests, please try again later.",
  })

Object.entries(rateLimitConfig).forEach(([route, options]) => {
  app.use(route, createLimiter(options))
})

const validateEmail = (email: string): boolean => validator.isEmail(email)

const passwordSchema = new PasswordValidator()
passwordSchema.is().min(8).is().max(64).has().letters().has().digits().has().not().spaces()

const listAccountsFromDocker = async (): Promise<Account[]> => {
  return new Promise((resolve, reject) => {
    const container = docker.getContainer("mailserver")
    container.exec(
      {
        Cmd: ["setup", "email", "list"],
        AttachStdout: true,
        AttachStderr: true,
      },
      (err, exec) => {
        if (err || !exec) return reject(err || new Error("Exec is undefined"))
        exec.start({}, (err, stream) => {
          if (err || !stream) return reject(err || new Error("Exec stream is undefined"))
          let output = ""
          stream.on("data", (chunk: Buffer) => (output += chunk.toString()))
          stream.on("end", () => {
            const regex = /\*\s*(\S+)\s*\(\s*([^\/]+?)\s*\/\s*([^)]+?)\s*\)\s*\[(\d+)%]/g
            const accounts: Account[] = [...output.matchAll(regex)].map((match) => ({
              email: match[1],
              used: match[2].trim() === "~" ? "Unlimited" : match[2].trim(),
              capacity: match[3].trim() === "~" ? "Unlimited" : match[3].trim(),
              percentage: match[4],
            }))
            resolve(accounts)
          })
        })
      },
    )
  })
}

const updateAccountsCache = async () => {
  const dockerAccounts = await listAccountsFromDocker();
  await db.delete(accounts);
  if (dockerAccounts.length > 0) {
    await db.insert(accounts).values(dockerAccounts);
  }
  await db
    .insert(cacheInfo)
    .values({ lastUpdated: Date.now() })
    .onConflictDoUpdate({ target: cacheInfo.id, set: { lastUpdated: Date.now() } });
};

app.get("/accounts/list", async (_req, res) => {
  try {
    const cacheData = await db.select().from(cacheInfo).limit(1)
    const lastUpdated = cacheData[0]?.lastUpdated || 0
    const currentTime = Date.now()

    if (currentTime - lastUpdated > 30 * 60 * 1000) {
      // 30 minutes
      await updateAccountsCache()
    }

    const accountsList = await db.select().from(accounts)
    res.json({ accounts: accountsList })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

app.post("/accounts/user", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  if (!validateEmail(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  try {
    const account = await db
      .select()
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);

    if (account.length > 0) {
      res.json({ account: account[0] });
    } else {
      res.status(404).json({ error: "Account not found" });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/accounts/update/password", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!validateEmail(email)) {
    console.log("Error updating password: Invalid email format");
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  const exec = await container.exec({
    Cmd: ["setup", "email", "update", email, password],
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
    exec.start({}, (err, stream) => {
      if (err || !stream) {
        reject(err || new Error("Exec stream is undefined"));
      } else {
        resolve(stream);
      }
    });
  });
  let output = "";
  stream.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  await new Promise<void>((resolve) => stream.on("end", resolve));
  console.log("Docker output (update password):\n", output);
  // detect errors
  if (/ERROR/i.test(output)) {
    console.log(`Error during migration: Password reset failed`);
    res.status(500).json({ error: "Error during reset" });
    return;
  } else {
    console.log(`Reset password for account: ${email}`);
    res.json({ success: true });
    return;
  }
});

// TODO: The wait upon account creation needs to be more adaptive
app.post("/accounts/add", async (req: Request, res: Response): Promise<void> => {
  const { email, password, migrate } = req.body;
  let failureReason = "";

  if (!validateEmail(email)) {
    console.log("Error adding account: Invalid email format");
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  let finalPassword = password;

  if (migrate) {
    try {
      const data = await fs.readFile("/app/migrate.txt", "utf8");
      const line = data.split("\n").find(l => l.trim() === email);
      if (!line) {
        failureReason = "Account not eligible";
        console.log(`Error adding account (migrate): ${failureReason}`);
        res.status(500).json({ error: "Backend error" });
        return;
      } else {
        const newData = data.replace(line, "");
        await fs.writeFile("/app/migrate.txt", newData);
        const exec = await container.exec({
          Cmd: ["setup", "email", "update", email, finalPassword],
          AttachStdout: true,
          AttachStderr: true,
        });
        const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
          exec.start({}, (err, stream) => {
            if (err || !stream) {
              reject(err || new Error("Exec stream is undefined"));
            } else {
              resolve(stream);
            }
          });
        });
        let output = "";
        stream.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        await new Promise<void>((resolve) => stream.on("end", resolve));
        console.log("Docker output (migrate update):\n", output);
        // detect errors
        if (/ERROR/i.test(output)) {
          failureReason = "Migration failed";
          console.log(`Error during migration: ${failureReason}`);
          res.status(500).json({ error: failureReason });
          return;
        } else {
          // force refresh
          await updateAccountsCache();
          const addedAccount = await db
            .select()
            .from(accounts)
            .where(eq(accounts.email, email))
            .limit(1);
          if (addedAccount.length > 0) {
            console.log(`Added account (via migrate): ${email}`);
            res.json({ success: true });
            return;
          } else {
            failureReason = "Migration failed";
            console.log(`Failed to migrate account: ${failureReason}`);
            res.status(500).json({ error: failureReason });
            return;
          }
        }
      }
    } catch (error) {
      failureReason = "Backend error";
      console.log(`Error adding account (migrate branch): ${failureReason}`, error);
      res.status(500).json({ error: failureReason });
      return;
    }
  } else {
    try {
      const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.email, email))
        .limit(1);
      if (account.length > 0) {
        console.log(`Account already exists: ${email}`);
        res.status(400).json({ error: "Account already exists" });
        return;
      }
    } catch (err) {
      console.log(`Error checking user: ${err}`);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }

  if (!finalPassword || !passwordSchema.validate(finalPassword)) {
    failureReason = "Invalid or weak password";
    console.log(`Failed to add account: ${failureReason}`);
    res.status(400).json({ error: failureReason });
    return;
  }

  // Non-migrate account creation route
  try {
    const exec = await container.exec({
      Cmd: ["setup", "email", "add", email, finalPassword],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      exec.start({}, (err, stream) => {
        if (err || !stream) {
          failureReason = "Failed to start Docker exec";
          console.log(`Failed to add account: ${failureReason}`, err);
          reject(err || new Error("Exec stream is undefined"));
        } else {
          resolve(stream);
        }
      });
    });

    let output = "";
    stream.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    await new Promise<void>((resolve) => stream.on("end", resolve));

    // poll db
    let accountFound = false;
    for (let attempt = 0; attempt < 15; attempt++) {
      await updateAccountsCache();
      const addedAccount = await db
        .select()
        .from(accounts)
        .where(eq(accounts.email, email))
        .limit(1);
      if (addedAccount.length > 0) {
        accountFound = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (accountFound) {
      console.log(`Added account: ${email}`);
      res.json({ success: true });
    } else {
      failureReason = "Timed out waiting for account creation";
      console.log(`Failed to add account: ${failureReason}`);
      res.status(500).json({
        error: "Check timed out waiting for account creation",
        failureReason,
      });
    }
  } catch (error) {
    failureReason = "Error executing Docker command";
    console.log(`Failed to add account: ${failureReason}`, error);
    res.status(500).json({ error: "Backend error" });
  }
});

const PORT = 3000
app.listen(PORT, () => console.log(`API listening on port ${PORT}`))

