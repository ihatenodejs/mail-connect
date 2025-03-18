import validator from "validator";
import PasswordValidator from "password-validator";
import fs from "fs/promises";
import path from "path";

let bannedPrefixesCache: string[] | null = null;

export const validateEmail = (email: string): boolean => validator.isEmail(email);

export const isBannedPrefix = async (email: string): Promise<boolean> => {
  try {
    if (!bannedPrefixesCache) {
      const filePath = path.join(process.cwd(), "data", "bannedprefix.txt");
      const data = await fs.readFile(filePath, "utf8");
      bannedPrefixesCache = data.split("\n").filter(prefix => prefix.trim());
    }
    const prefix = email.split("@")[0];
    return bannedPrefixesCache.includes(prefix);
  } catch (error) {
    console.error("[!] Error checking for banned prefix:", error);
    return false;
  }
}

export const passwordSchema = new PasswordValidator();
passwordSchema.is().min(8).is().max(64).has().letters().has().digits().has().not().spaces();

export const validatePassword = (password: string): boolean => <boolean>passwordSchema.validate(password);