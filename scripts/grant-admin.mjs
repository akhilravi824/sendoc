#!/usr/bin/env node
// Bootstrap script: grant a Firebase user the "admin" role (or another role).
//
// Usage:
//   node scripts/grant-admin.mjs <email> [role]
//   node scripts/grant-admin.mjs reshmarajan3590@gmail.com admin
//
// The user must have signed in to sendoc at least once (with Google) so
// that they exist in Firebase Auth.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env.local");

if (!fs.existsSync(envPath)) {
  console.error(`Cannot find ${envPath}`);
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      if (i < 0) return null;
      let k = l.slice(0, i).trim();
      let v = l.slice(i + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return [k, v];
    })
    .filter(Boolean),
);

const [, , email, roleArg] = process.argv;
const role = roleArg || "admin";

if (!email) {
  console.error("Usage: node scripts/grant-admin.mjs <email> [role]");
  process.exit(1);
}

const VALID = ["user", "moderator", "admin", "super_admin"];
if (!VALID.includes(role)) {
  console.error(`Invalid role: ${role}. Must be one of: ${VALID.join(", ")}`);
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const auth = getAuth();
const db = getFirestore();

try {
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { role });

  await db
    .collection("users")
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        role,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        updatedAt: new Date(),
      },
      { merge: true },
    );

  await db.collection("adminAudits").add({
    actor: { uid: "bootstrap-script", email: null, role: "super_admin" },
    action: "user.grantRole",
    target: { type: "user", id: user.uid },
    reason: `bootstrap script granted ${role}`,
    diff: { before: { role: "user" }, after: { role } },
    createdAt: new Date(),
  });

  console.log(`✔ Granted role "${role}" to ${email} (uid: ${user.uid}).`);
  console.log(
    "  The user must sign out and back in (or wait up to 1h for the ID token to refresh) before the claim takes effect.",
  );
  process.exit(0);
} catch (err) {
  if (err.code === "auth/user-not-found") {
    console.error(`No Firebase user with email ${email}.`);
    console.error(
      "Have them sign in to sendoc (with Google) at least once first.",
    );
  } else {
    console.error(err);
  }
  process.exit(1);
}
