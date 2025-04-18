import express from "express";
import figlet from "figlet";
import { createLimiter, loadRateLimitConfig } from "./utils/rateLimit";
import { listAccounts } from "./actions/accounts/listAccounts";
import { getUserAccount } from "./actions/accounts/getUserAccount";
import { updatePassword } from "./actions/accounts/updatePassword";
import { addAccount } from "./actions/accounts/addAccount";
import initialChecks from "./actions/initialChecks";
import { deleteAccount } from "./actions/accounts/deleteAccount";
import { updateAccountsCache } from "./utils/updateAccountsCache";

const app = express();
app.use(express.json());

console.log("==== SELF CHECK STARTING ====\n");
const rCResult = initialChecks();
if (!rCResult) {
  console.log("\n====   SELF CHECK FAIL   ====");
  process.exit(1);
} else {
  console.log("\n====   SELF CHECK PASS   ====\n");
}

// Get version
const pkg = Bun.file("package.json");
const pkgData = await pkg.json();
const version = pkgData.version;

interface RateLimitOptions {
  windowMs: number;
  limit: number;
  message?: string;
}

let rateLimitConfig = {};
(async () => {
  rateLimitConfig = await loadRateLimitConfig();
  Object.entries(rateLimitConfig).forEach(([route, options]) => {
    app.use(route, createLimiter(<RateLimitOptions>options));
  });
})();

app.get("/accounts/list", listAccounts);
app.post("/accounts/user", getUserAccount);
app.post("/accounts/update/password", updatePassword);
app.post("/accounts/add", addAccount);
app.post("/accounts/delete", deleteAccount);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  figlet('mail-connect', (err, data) => {
    if (err) {
      console.log('mail-connect');
      console.log(`Version: ${version}`);
      console.log(`API listening on port ${PORT}\n`);
      console.log("[!] " + err);
      updateAccountsCache();
    } else {
      console.log(data);
      console.log(`Version: ${version}`);
      console.log(`API listening on port ${PORT}\n`);
      updateAccountsCache();
    }
  });
});