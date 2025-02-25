import { Request, Response } from "express";
import { accounts } from "../../db/schema";
import { eq } from "drizzle-orm";
import { validateEmail } from "../../utils/validators";
import { drizzle } from "drizzle-orm/bun-sqlite";

const db = drizzle(process.env.DB_FILE_NAME!);

export const getUserAccount = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  console.log("[*] Task started\nTASK| getUserAccount\nACC |", email);

  if (!validateEmail(email)) {
    console.log("[!] Error\nTASK| getUserAccount\nERR | Invalid email format\nACC |", email);
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
      console.log("[*] Task completed\nTASK| getUserAccount\nACC |", email);
      res.json({ account: account[0] });
    } else {
      console.log("[!] Error\nTASK| getUserAccount\nERR | Account not found\nACC |", email);
      res.status(404).json({ error: "Account not found" });
    }
  } catch (err) {
    console.log("[!] Error\nTASK| getUserAccount\nERR | Unspecified error\nACC |", email);
    res.status(500).json({ error: (err as Error).message });
  }
};