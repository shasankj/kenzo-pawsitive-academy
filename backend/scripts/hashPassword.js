import { hashPassword } from "../shared/password.js";

// Usage (run from the coaching-api folder):
//   node scripts/hashPassword.js 'YourStrongPassword'
// Paste the printed hash into the password_hash column (see sql/04_auth_and_approval.sql).
// Only run this on your own machine, and prefer a password you will change after first login.
const password = process.argv[2];

if (!password || password.length < 8) {
  console.error("Usage: node scripts/hashPassword.js '<password of at least 8 characters>'");
  process.exit(1);
}

console.log(await hashPassword(password));
