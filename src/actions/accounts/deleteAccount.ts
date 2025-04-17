import { Request, Response } from "express";
import { accounts } from "../../db/schema";
import { eq } from "drizzle-orm";
import { validateEmail } from "../../utils/validators";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { containerExec } from "../../utils/docker";
import { updateAccountsCache } from "../../utils/updateAccountsCache";

const db = drizzle(process.env.DB_FILE_NAME!);

export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    console.log("[!] Error\nTASK| deleteAccount\nERR | Missing email\nACC |", email);
    res.status(400).json({ success: false, error: "Missing email" });
    return
  }

  if (!validateEmail(email)) {
    console.log("[!] Error\nTASK| deleteAccount\nERR | Invalid email format\nACC |", email);
    res.status(400).json({ success: false, error: "Invalid email format" });
    return;
  }

  const accInDb = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  if (!accInDb || accInDb.length === 0) {
    console.log("[!] Error\nTASK| deleteAccount\nERR | Account not found\nACC |", email);
    res.status(404).json({ success: false, error: "Account not found" });
    return;
  }

  console.log("[*] Task started\nTASK| deleteAccount\nACC |", email);

  try {
    await db.delete(accounts).where(eq(accounts.email, email));
    console.log("[+] Internal account deleted\nTASK| deleteAccount\nACC |", email);

    try {
      const output = await containerExec(["setup", "email", "del", email]);
      if (/ERROR/i.test(output)) {
        console.log("[!] Error\nTASK| deleteAccount\nERR | Mail account removal failed\nACC |", email);
        res.status(500).json({ success: false, error: "Mail account removal failed" });
        return;
      } else {
        console.log("[+] Mail account removed\nTASK| deleteAccount\nACC |", email);
      }
    } catch (err) {
      console.log("[!] Error\nTASK| deleteAccount\nERR | Mail account removal failed\nACC |", email);
      res.status(500).json({ success: false, error: "Mail account removal failed" });
      return;
    }

    console.log("[-] Updating accounts cache");
    await updateAccountsCache();

    console.log("[-] Performing final checks");
    const accInDb = await db
      .select()
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);
    
    if (!accInDb || accInDb.length === 0) {
      console.log("[*] Task completed\nTASK| deleteAccount\nACC |", email);
      res.json({ success: true });
    } else {
      console.log("[!] Error\nTASK| deleteAccount\nERR | Account not found\nACC |", email);
      res.status(404).json({ success: false, error: "Account not found" });
    }
  } catch (err) {
    console.log("[!] Error\nTASK| deleteAccount\nERR | Unspecified error\nACC |", email);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
};