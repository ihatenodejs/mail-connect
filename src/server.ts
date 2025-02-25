import express from "express";
import figlet from "figlet";
import { createLimiter, loadRateLimitConfig } from "./utils/rateLimit";
import { listAccounts } from "./actions/accounts/listAccounts";
import { getUserAccount } from "./actions/accounts/getUserAccount";
import { updatePassword } from "./actions/accounts/updatePassword";
import { addAccount } from "./actions/accounts/addAccount";

const app = express();
app.use(express.json());

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

const PORT = 3000;
app.listen(PORT, () => {
  figlet('mail-connect', (err, data) => {
    if (err) {
      console.log('mail-connect');
      console.log('Version: 0.1.0');
      console.log(`API listening on port ${PORT}\n`);
      console.dir("[!] " + err);
    } else {
      console.log(data);
      console.log('Version: 0.1.0');
      console.log(`API listening on port ${PORT}\n`);
    }
  });
});