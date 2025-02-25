import { Request, Response } from "express";
import { containerExec } from "../../utils/docker";
import { validateEmail } from "../../utils/validators";

export const updatePassword = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  console.log("[*] Task started\nTASK| updatePassword\nACC |", email);

  if (!validateEmail(email)) {
    console.log("[!] Error\nTASK| updatePassword\nERR | Invalid email format\nACC |", email);
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  try {
    const output = await containerExec(["setup", "email", "update", email, password]);
    if (/ERROR/i.test(output)) {
      console.log("[!] Error\nTASK| updatePassword\nERR | Password update failed\nACC |", email);
      res.status(500).json({ error: "Error during reset" });
    } else {
      console.log("[*] Task completed\nTASK| updatePassword\nACC |", email);
      res.json({ success: true });
    }
  } catch (err) {
    console.log("[!] Error\nTASK| updatePassword\nERR | Unspecified error\nACC |", email);
    res.status(500).json({ error: (err as Error).message });
  }
};