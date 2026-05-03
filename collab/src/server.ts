// sendoc collab — Hocuspocus + Yjs WebSocket server.
//
// Brokers real-time edits between concurrent users on the same doc.
// Connects to the same Firestore project as the Next app so it can
// validate editTokens before opening a connection.
//
// Auth model:
//   - Client connects to ws://host/<docId>?token=<editToken>
//   - onAuthenticate validates the editToken against the doc by
//     comparing peppered-HMAC + legacy SHA-256 (mirrors the Next app's
//     lookupHashes pattern in src/lib/secret-hash.ts so a single token
//     authorizes both surfaces)
//   - Connection rejected on miss or wrong doc
//
// Persistence model:
//   - Yjs state is in-memory only on this server (V1)
//   - The CLIENT also debounces a markdown PATCH back to the Next app's
//     /api/edit/[editToken] endpoint — that's the durable record
//   - Server restarts drop the live Yjs CRDT state but never lose the
//     content (it's in Firestore as markdown)
//
// Env vars:
//   PORT                          — listen port (defaults to 1234)
//   FIREBASE_ADMIN_PROJECT_ID
//   FIREBASE_ADMIN_CLIENT_EMAIL
//   FIREBASE_ADMIN_PRIVATE_KEY    — same shape as the Next app uses
//   API_KEY_PEPPER                — must match the Next app exactly,
//                                   otherwise editToken hashes won't
//                                   match the ones in Firestore
//   ALLOWED_ORIGINS               — comma-separated list (e.g.
//                                   https://sendoc.app,https://*.vercel.app)

import { Hocuspocus } from "@hocuspocus/server";
import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import crypto from "node:crypto";

// ── Firebase Admin ──────────────────────────────────────────────────────

function getApp(): App {
  if (getApps().length) return getApps()[0]!;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "[collab] Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY.",
    );
  }
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

let _db: Firestore | null = null;
function db(): Firestore {
  if (!_db) _db = getFirestore(getApp());
  return _db;
}

// ── Hashing (mirrors src/lib/secret-hash.ts) ───────────────────────────

const FALLBACK_PEPPER =
  "sendoc-dev-pepper-do-not-use-in-prod-c8f1e9a7b3d2e6f4";

function pepper(): string {
  return process.env.API_KEY_PEPPER || FALLBACK_PEPPER;
}

function pepperedHash(token: string): string {
  return crypto.createHmac("sha256", pepper()).update(token).digest("hex");
}

function legacyHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ── Hocuspocus server ───────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 1234);

const server = new Hocuspocus({
  port: PORT,
  address: "0.0.0.0",
  name: "sendoc-collab",

  /**
   * Hocuspocus calls onAuthenticate with the documentName (the docId
   * embedded in the URL) and the token (passed in as `token` from
   * HocuspocusProvider's `token` option). We treat the token as the
   * editToken for that doc and validate against Firestore.
   */
  async onAuthenticate({ documentName, token }) {
    if (!token) throw new Error("missing token");
    if (!documentName) throw new Error("missing documentName");

    const newHash = pepperedHash(token);
    const oldHash = legacyHash(token);

    const snap = await db()
      .collection("docs")
      .where("editTokenHash", "in", [newHash, oldHash])
      .limit(1)
      .get();

    if (snap.empty) throw new Error("invalid token");
    const data = snap.docs[0].data();

    if (data.docId !== documentName) {
      throw new Error("token does not match doc");
    }
    if (data.status !== "active") {
      throw new Error("doc not active");
    }

    // Pass identifying context to subsequent hooks (e.g. for logging).
    return {
      docId: data.docId,
      ownerId: data.ownerId ?? null,
    };
  },

  /**
   * Fires when a connection's first sync completes. Useful for logging.
   */
  async onConnect({ documentName }) {
    console.log(`[collab] connect ${documentName}`);
  },

  async onDisconnect({ documentName, clientsCount }) {
    console.log(`[collab] disconnect ${documentName} (${clientsCount} left)`);
  },
});

server
  .listen()
  .then(() => {
    console.log(`[collab] sendoc-collab listening on :${PORT}`);
  })
  .catch((err) => {
    console.error("[collab] failed to start:", err);
    process.exit(1);
  });

// Graceful shutdown so Fly/Railway/Render rolling deploys close clients.
function shutdown(signal: string) {
  console.log(`[collab] received ${signal}, shutting down`);
  server
    .destroy()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[collab] error during shutdown:", err);
      process.exit(1);
    });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
