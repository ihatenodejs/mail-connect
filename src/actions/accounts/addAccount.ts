import { Request, Response } from "express";
import { containerExec } from "../../utils/docker";
import { validateEmail, validatePassword } from "../../utils/validators";
import { accounts } from "../../db/schema";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { updateAccountsCache } from "../../utils/updateAccountsCache";
import { isBannedPrefix } from "../../utils/validators";

const db = drizzle(process.env.DB_FILE_NAME!);

export const addAccount = async (req: Request, res: Response): Promise<void> => {
  const { email, password, migrate } = req.body;

  if (!email || !password) {
    console.log("[!] Error\nTASK| addAccount\nERR | Missing email or password");
    res.status(400).json({ error: "Missing email or password" });
    return;
  }

  if (!validateEmail(email)) {
    console.log("[!] Error\nTASK| addAccount\nERR | Invalid email format");
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  if (await isBannedPrefix(email)) {
    console.log("[!] Error\nTASK| addAccount\nERR | Banned email prefix\nACC |", email);
    res.status(400).json({ error: "Banned email prefix" });
    return;
  }

  let finalPassword = password;

  if (migrate) {
    console.log("[*] Task started\nTASK| addAccount (subtask: migrate)\nACC |", email);
    try {
      const data = await fs.readFile("/app/migrate.txt", "utf8");
      const line = data.split("\n").find(l => l.trim() === email);
      if (!line) {
        console.log("[!] Error\nTASK| addAccount (subtask: migrate)\nERR | Account not found in migrate.txt\nACC |", email);

        // A backend error is returned so users do not attempt to abuse the migration form
        res.status(500).json({ error: "Backend error" });
        return;
      } else {
        const newData = data.replace(line, "");
        await fs.writeFile("/app/migrate.txt", newData);
        const output = await containerExec(["setup", "email", "update", email, finalPassword]);
        if (/ERROR/i.test(output)) {
          console.log("[!] Error\nTASK| addAccount (subtask: migrate)\nERR | Password update failed\nACC |", email);
          res.status(500).json({ error: "Migration failed" });
          return;
        } else {
          await updateAccountsCache();
          const addedAccount = await db
            .select()
            .from(accounts)
            .where(eq(accounts.email, email))
            .limit(1);
          if (addedAccount.length > 0) {
            console.log("[*] Task completed\nTASK| addAccount (subtask: migrate)\nACC |", email);
            res.json({ success: true });
            return;
          } else {
            console.log("[!] Error\nTASK| addAccount (subtask: migrate)\nERR | Account not found in database\nACC |", email);
            res.status(500).json({ error: "Migration failed" });
            return;
          }
        }
      }
    } catch (error) {
      // the [1] makes it easy to identify where errors with the same message are coming from
      console.log("[!] Error\nTASK| addAccount (subtask: migrate)\nERR | [1] Unspecified error\nACC |", email);
      res.status(500).json({ error: "Backend error" });
      return;
    }
  } else {
    console.log("[*] Task started\nTASK| addAccount\nACC |", email);
    try {
      const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.email, email))
        .limit(1);
      if (account.length > 0) {
        console.log("[!] Error\nTASK| addAccount\nERR | Account already exists\nACC |", email);
        res.status(400).json({ error: "Account already exists" });
        return;
      }
    } catch (err) {
      console.log("[!] Error\nTASK| addAccount\nERR | [2] Unspecified error\nLOGS|", err);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }

  if (!finalPassword || !validatePassword(finalPassword)) {
    console.log("[!] Error\nTASK| addAccount\nERR | Invalid or weak password\nACC |", email);
    res.status(400).json({ error: "Invalid or weak password" });
    return;
  }

  try {
    const output = await containerExec(["setup", "email", "add", email, finalPassword]);
    if (/ERROR/i.test(output)) {
      console.log("[!] Error\nTASK| addAccount\nERR | Error during account creation\nACC |", email);
      res.status(500).json({ error: "Error during account creation" });
      return;
    }
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
      console.log("[*] Task completed\nTASK| addAccount\nACC |", email);
      res.json({ success: true });
    } else {
      console.log("[!] Error\nTASK| addAccount\nERR | Timed out waiting for account creation\nACC |", email);
      res.status(500).json({
        error: "Check timed out waiting for account creation",
        failureReason: "Timed out waiting for account creation",
      });
    }
  } catch (error) {
    console.log("[!] Error\nTASK| addAccount\nERR | [3] Unspecified error\nLOGS|", error);
    res.status(500).json({ error: "Backend error" });
  }
};