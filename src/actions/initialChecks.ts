import fs from "fs";

const requiredEnvVars = ['MIGRATE_TXT', 'DB_FILE_NAME', 'MAILCONNECT_ROOT_DIR'];

function checkRatelimit() {
  const ratelimitExists = fs.existsSync("ratelimit.json");
  if (!ratelimitExists) {
    console.log("[!] Ratelimit config not found");
    return false;
  } else {
    console.log("[✓] Found ratelimit config");
    return true;
  };
};

function checkEnv() {
  const envExists = fs.existsSync(".env");
  if (!envExists) {
    console.log("[!] .env file not found");
    return false;
  } else {
    console.log("[✓] Found .env file");
    let allVarsPresent = true;

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.log(`    [!] ${envVar} not found`);
        allVarsPresent = false;
      } else {
        console.log(`    [✓] Found ${envVar}`);
      }
    }

    if (!allVarsPresent) {
      return false;
    } else {
      return true;
    }
  };
};

// the return value of this function determines if server should exit early
export default function initialChecks() {
  const ratelimitCheck = checkRatelimit();
  const envCheck = checkEnv();

  if (!ratelimitCheck || !envCheck) {
    return false;
  } else {
    return true;
  }
};