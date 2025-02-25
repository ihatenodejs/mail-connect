import { Request, Response } from "express";
import { cacheInfo, accounts } from "../../db/schema";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { updateAccountsCache } from "../../utils/updateAccountsCache";

const db = drizzle(process.env.DB_FILE_NAME!);

export const listAccounts = async (_req: Request, res: Response): Promise<void> => {
  console.log("[*] Task started\nTASK| listAccounts");

  try {
    const cacheData = await db.select().from(cacheInfo).limit(1);
    const lastUpdated = cacheData[0]?.lastUpdated || 0;
    const currentTime = Date.now();

    if (currentTime - lastUpdated > 30 * 60 * 1000) {
      // 30 minutes
      await updateAccountsCache();
    }

    const accountsList = await db.select().from(accounts);
    console.log("[*] Task completed\nTASK| listAccounts");
    res.json({ accounts: accountsList });
  } catch (err) {
    console.log("[!] Error\nTASK| listAccounts\nERR | Unspecified error\nLOG |", (err as Error).message);
    res.status(500).json({ error: (err as Error).message });
  }
};