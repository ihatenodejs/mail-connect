import { listAccountsFromDocker } from "./docker";
import { accounts, cacheInfo } from "../db/schema";
import { drizzle } from "drizzle-orm/bun-sqlite";

const db = drizzle(process.env.DB_FILE_NAME!);

export const updateAccountsCache = async () => {
  const dockerAccounts = await listAccountsFromDocker();
  await db.delete(accounts);
  if (dockerAccounts.length > 0) {
    await db.insert(accounts).values(dockerAccounts);
  }
  await db
    .insert(cacheInfo)
    .values({ lastUpdated: Date.now() })
    .onConflictDoUpdate({ target: cacheInfo.id, set: { lastUpdated: Date.now() } });
  console.log("[+] Accounts cache updated");
};