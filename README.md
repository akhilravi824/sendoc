# sendoc

AI-generated collaborative documents. Sprint 1-2 scaffold — **hybrid auth (no login required)**, AI doc generation with Claude streaming, save to Firestore.

## Auth model

Every visitor is automatically signed in **anonymously** the moment they land on the site — no friction, no popup, no decision. They get a real Firebase UID and can immediately create documents and use AI.

A persistent "Save your work" banner offers an upgrade to Google sign-in. Clicking it calls `linkWithPopup`, which converts the anonymous account into a Google-backed one **without losing any documents** (same UID, just different identity provider).

Daily rate limits per UID (enforced server-side):
- Anonymous: 5 AI generations / day
- Signed in: 25 AI generations / day
- Pro / Business / Enterprise: configured in Sprint 6 with Stripe

## Run it locally (the order matters)

### 1. Install dependencies

```bash
cd sendoc
npm install
```

This downloads ~400MB of packages into `node_modules/`. Takes 1-3 min.

### 2. Create a Firebase project

Web walkthrough: see "Firebase setup" below.

### 3. Create `.env.local`

```bash
cp .env.example .env.local
```

Open `.env.local` in VS Code and fill in:

- All `NEXT_PUBLIC_FIREBASE_*` values (from Firebase console → Project Settings → "Your apps" → Web app)
- All `FIREBASE_ADMIN_*` values (from Firebase console → Project Settings → Service accounts → Generate new private key)
- `ANTHROPIC_API_KEY` (from console.anthropic.com → API Keys)

### 4. Deploy the Firestore security rules

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # pick your sendoc project
firebase deploy --only firestore:rules
```

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000 → Sign in with Google → start generating.

---

## Firebase setup (one-time)

1. Go to https://console.firebase.google.com → "Add project" → name it `sendoc` → continue (Google Analytics off is fine for now).
2. In the new project, click **Build → Authentication → Get started → Sign-in method**.
   - Enable **Anonymous** → Save. (Required — this is what lets visitors use the app without logging in.)
   - Enable **Google** → set support email → Save. (Required — for the optional "save your work" upgrade.)
3. Click **Build → Firestore Database → Create database → Production mode → pick a region near you** (e.g. `us-central` if in the US, `europe-west` if in Europe). Wait ~30s for it to spin up.
4. Click the gear icon next to "Project Overview" → **Project settings**.
5. Scroll to "Your apps" → click the `</>` (Web) button → register app with nickname `sendoc-web` → **DON'T enable Firebase Hosting** → Register.
6. Copy the `firebaseConfig` values into the `NEXT_PUBLIC_FIREBASE_*` lines of `.env.local`.
7. Switch to the **Service accounts** tab in Project Settings → **Generate new private key** → download the JSON file.
8. Open the JSON. Copy:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (wrap the whole thing in double quotes — the `\n` characters need to stay literal)
9. **Delete the downloaded JSON file from your Downloads folder** — never commit it.

## Architecture (what each file does)

```
src/
├── app/
│   ├── page.tsx                  Landing / login redirect
│   ├── login/page.tsx            Standalone login page
│   ├── dashboard/page.tsx        Doc list + new-doc prompt box
│   ├── doc/[docId]/page.tsx      Single doc view + editor
│   └── api/
│       ├── docs/route.ts         POST → create new doc
│       └── generate/route.ts     POST → stream Claude into a doc
├── components/
│   ├── AuthProvider.tsx          React context for current user + ID token
│   ├── SignInButton.tsx          Google sign-in popup
│   ├── SignOutButton.tsx
│   ├── PromptBox.tsx             Dashboard "type a prompt" form
│   └── DocEditor.tsx             Live-updating doc + AI streaming hook
└── lib/
    ├── firebase.ts               Client SDK init (browser)
    ├── firebase-admin.ts         Admin SDK init (server) + token verification
    └── anthropic.ts              Claude client + system prompt
```

## What's missing vs. the spec

This scaffold covers Sprints 1-2 of the CollabAI spec. Still to come:

- **Sprint 3**: share links, ACL, identity-gated access for non-owners
- **Sprint 4**: real-time collaboration (Yjs + Hocuspocus + Tiptap rich text editor)
- **Sprint 5**: inline chat + presence cursors
- **Sprint 6**: Stripe + freemium limits
- **Sprint 7**: GPT-4 + Gemini adapters (model picker)
- **Sprint 8-11**: mobile polish, audit log UI, custom domains, SAML SSO

Each sprint is additive — nothing in this scaffold gets thrown away.
