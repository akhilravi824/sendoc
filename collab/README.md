# sendoc-collab

Real-time collaboration server for sendoc. Hocuspocus + Yjs over
WebSocket. Brokers concurrent edits between multiple users on the same
`/edit/[editToken]` page.

## What this service does

- Accepts WebSocket connections from Tiptap clients in the Next app
- Validates the `editToken` against Firestore on connect (same peppered
  HMAC scheme as the Next app, see `src/lib/secret-hash.ts`)
- Brokers Yjs CRDT state between connected peers in the same doc room
- In-memory only — durable storage stays in Firestore as markdown,
  written by the client's existing PATCH-on-change loop

## Local dev

```bash
# In one terminal:
cd collab/
cp .env.example .env  # create this, paste Firebase admin creds + pepper
npm install
npm run dev   # tsx watch — listens on :1234

# In another terminal:
cd ..
NEXT_PUBLIC_COLLAB_URL=ws://localhost:1234 npm run dev
```

Open `http://localhost:3000/edit/<token>` in two browsers — edits sync
in real time.

## Deploy (Fly.io)

See the comment header in `fly.toml`. TL;DR:

```bash
cd collab/
flyctl auth signup
flyctl launch --no-deploy --copy-config --name sendoc-collab
flyctl secrets set FIREBASE_ADMIN_PROJECT_ID=...
flyctl secrets set FIREBASE_ADMIN_CLIENT_EMAIL=...
flyctl secrets set FIREBASE_ADMIN_PRIVATE_KEY="$(cat path/to/key.txt)"
flyctl secrets set API_KEY_PEPPER=...
flyctl deploy
```

Then in Vercel, add `NEXT_PUBLIC_COLLAB_URL=wss://sendoc-collab.fly.dev`
and redeploy.

## Required env vars

| Var | What | Where it lives |
|---|---|---|
| `PORT` | listen port (default 1234) | optional |
| `FIREBASE_ADMIN_PROJECT_ID` | same as Next app | service account |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | same as Next app | service account |
| `FIREBASE_ADMIN_PRIVATE_KEY` | same as Next app | service account |
| `API_KEY_PEPPER` | **must** match the Next app's value exactly | secret |

If `API_KEY_PEPPER` mismatches the Next app, the editToken hash lookup
fails and **every** connection is rejected. This is the most common
cause of "WebSocket closes immediately" symptoms in dev.
