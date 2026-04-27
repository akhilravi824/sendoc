# sendoc — Storyboard

> Living document. Updated as work ships. Last refresh: 2026-04-26.

## North Star

**Sendoc appears in ChatGPT's default `+` menu and Claude.ai's default Connectors list** — alongside Figma, GitHub, Gmail, Linear. Users don't search a marketplace; sendoc is *there* when they need to publish.

Realistic timeline: **6–12 months**. Most of the work is distribution + compliance + traction, not code.

---

## Where we are

```
✅ Shipped       Anonymous publish · API key publish · Magic edit links
                 ChatGPT Custom GPT · Claude MCP server · Markdown render
                 HTML render (sandboxed) · Share dropdown · Make-a-copy
                 Admin moderation v2 · Audit log + viewer · Privacy/Terms
                 Landing page · Branding · Sentry · CI · GDPR delete
                 AI-edit on shared docs (Ask AI button on /edit) ⭐ NEW

⚠️ Half-done    Identity-gated ACL  (token-only today)
                 Multi-model AI       (Claude only — Ask AI ships on Claude)
                 Link TTL enforcement (field exists, not enforced)
                 Per-user plans       (rate limits hardcoded, no plan tiers)

❌ Not started   Real-time collab · Inline chat · Stripe · Workspaces
                 Notifications · Version history · Export · SAML
                 Encrypt-at-rest · Custom domain · Daily Firestore backup
```

---

## Lanes

### 🚀 Lane 1 — Distribution unlock (this is the path to the vision)

| Priority | Task | Effort | Owner | Blockers |
|---|---|---|---|---|
| 🔴 P0 | **Buy custom domain** (e.g. `sendoc.app`) | 5 min + ~$15/yr | Akhil | None |
| 🔴 P0 | **Connect domain to Vercel** + DNS | 10 min | Akhil + me | After domain bought |
| 🔴 P0 | **Update GPT instructions** to surface `editUrl` (paste new instructions in GPT builder) | 2 min | Akhil | None |
| 🔴 P0 | **Publish GPT to "Anyone with link"** | 1 click | Akhil | Privacy URL → use `https://sendoc-akhilravi824s-projects.vercel.app/privacy` (already live) |
| 🟡 P1 | **Submit GPT to GPT Store** (public discovery) | 1 hr | Akhil | Custom domain + lawyer-reviewed Privacy/Terms |
| 🟡 P1 | **Add MCP URL to Claude.ai connectors** + verify it works in real chat | 5 min | Akhil | Claude.ai Pro/Team subscription |
| 🟡 P1 | **Lawyer review of Privacy + Terms** | $200–500 or $20/mo Termly | Akhil | None |
| 🟢 P2 | **Apply to OpenAI Apps program** | 2 hrs paperwork | Akhil | Custom domain + traction (~100+ active users) |
| 🟢 P2 | **Apply to Anthropic MCP Partner Directory** | 2 hrs paperwork | Akhil | Custom domain + traction |

### 🛡️ Lane 2 — Compliance / partner-eligibility

| Priority | Task | Effort | Owner | Blockers |
|---|---|---|---|---|
| 🟡 P1 | **Encrypt API keys at rest** (currently SHA-256 hash; partners may want envelope encryption via KMS) | 2–3 hrs | me | None |
| 🟡 P1 | **Daily Firestore backup** (Vercel cron triggers `firestore.exportDocuments` to GCS bucket) | 45 min build + 5 min GCP setup | me + Akhil | GCS bucket + IAM grant |
| 🟢 P2 | **Per-action audit log** (currently only admin actions logged — spec wants every edit/AI/share too) | 4–6 hrs | me | None |
| 🟢 P2 | **Documented data flow / SOC 2 prep doc** | 1 day | Akhil | Required only at Enterprise tier |

### 👥 Lane 3 — Collaboration (path B from earlier — per-user ACL)

| Priority | Task | Effort | Owner | Blockers |
|---|---|---|---|---|
| 🟡 P1 | **Sign up for Resend + paste API key** | 2 min | Akhil | None |
| 🟡 P1 | **Claim flow** (anonymous doc → owned by signed-in user via editToken) | 1.5 hrs | me | After Resend |
| 🟡 P1 | **Collaborator schema** + invite/list/remove APIs | 3 hrs | me | After Resend |
| 🟡 P1 | **Email invitations** via Resend | 1 hr | me | After Resend + claim flow |
| 🟡 P1 | **Invite acceptance page** (signed-in user accepts → gets edit access) | 1 hr | me | After collaborator schema |
| 🟢 P2 | **Identity-gated ACL** with Google identity + role hierarchy (Owner/Co-owner/Editor/Viewer/Revoked) | 2 hrs after collaborators | me | After collaborator schema |
| 🟢 P2 | **Instant revocation** + WebSocket disconnect (when we add real-time) | 1 hr | me | After Lane 4 |

### ✏️ Lane 4 — Real-time collaboration (path C — biggest scope)

| Priority | Task | Effort | Owner | Blockers |
|---|---|---|---|---|
| 🟢 P2 | **Pick host for Hocuspocus** (Railway / Fly.io / Render) — Vercel can't do persistent WebSockets | Decision + signup | Akhil | None — but defer until users ask |
| 🟢 P2 | **Build Hocuspocus + Yjs server** (separate Node service) | 1 day | me | After host picked |
| 🟢 P2 | **Replace textarea with Tiptap editor** | 1 day | me | After Hocuspocus running |
| 🟢 P2 | **Wire Yjs sync between Tiptap + Hocuspocus** | 0.5 day | me | After Tiptap |
| 🟢 P2 | **Live cursors + presence indicators** | 0.5 day | me | After Yjs sync |
| 🟢 P2 | **Persist Yjs snapshots to Firestore every 5s** | 2 hrs | me | After Yjs sync |
| 🟢 P3 | **Inline chat per doc** (@mentions, replies on selections) | 1 day | me | After real-time collab |

### 🤖 Lane 5 — AI features

| Priority | Task | Effort | Owner | Blockers |
|---|---|---|---|---|
| 🟢 P2 | **Multi-model adapter pattern** (Claude / GPT-4 / Gemini / BYO-key) | 3–4 hrs | me | OpenAI + Google AI keys (Akhil) |
| 🟢 P2 | **Model picker UI** for Pro tier | 1 hr | me | After plans exist |
| ✅ Done | ~~**Ask AI on shared edit URL** — collaborator opens edit URL, clicks Ask AI, types instruction (e.g. "add hotel section"), AI rewrites the doc, user previews + applies~~ — shipped 2026-04-26 | — | me | — |
| 🟢 P3 | **Inline AI** — select text → "rewrite / summarize / expand" (selection-aware, not whole-doc) | 4 hrs | me | After Tiptap (Lane 4) |
| 🟢 P3 | **AI suggestions as tracked changes** | 1 day | me | After inline AI |
| 🟢 P3 | **Prompt caching** to reduce Anthropic costs | 2 hrs | me | None — nice-to-have |
| 🟢 P3 | **AI usage dashboard** for users (tokens used, cost) | 3 hrs | me | After multi-model |

### 💰 Lane 6 — Monetization

| Priority | Task | Effort | Owner | Blockers |
|---|---|---|---|---|
| 🟢 P3 | **Stripe account + product setup** (Free / Pro $12 / Business $28) | 1 hr | Akhil | Wait until 50–100+ users |
| 🟢 P3 | **Plan field on user profile** + plan-aware rate limits | 2 hrs | me | After Stripe |
| 🟢 P3 | **Stripe Checkout integration** + webhook | 4 hrs | me | After Stripe + plan |
| 🟢 P3 | **Per-month AI usage counter** (currently per-day) | 1 hr | me | After plan field |
| 🟢 P3 | **Plan upgrade UI / paywall moments** | 4 hrs | me | After checkout works |
| 🟢 P3 | **Link TTL enforcement** (7d free / 90d Pro / 1yr Business) | 1 hr | me | After plan field |
| 🟢 P3 | **Watermark removal on Pro+** (currently always shown) | 30 min | me | After plan field |

### 📦 Lane 7 — Power-user / polish

| Priority | Task | Effort | Owner | Blockers |
|---|---|---|---|---|
| 🟡 P1 | **Per-doc subdomain isolation** for scripts in HTML docs (e.g., `<token>.docs.sendoc.app`) | 1–2 days | me | Custom domain |
| 🟢 P2 | **PDF / HTML export** | 4–6 hrs | me | Pro tier or free? — product call |
| 🟢 P2 | **Version history** (Yjs snapshots already needed for Lane 4) | 1 day | me | After Yjs |
| 🟢 P2 | **Notifications service** (email-on-report ✓ partial, push, in-app) | 1 day | me | Resend (Lane 3) |
| 🟢 P3 | **Mobile share-view polish** (currently responsive — could be more native) | 2 hrs | me | None |
| 🟢 P3 | **Better logo design** (current is text + simple SVG mark) | $200–500 designer | Akhil | None |

### 🏢 Lane 8 — Enterprise / scale

| Priority | Task | Effort | Owner | Blockers |
|---|---|---|---|---|
| 🟢 P3 | **Workspaces / multi-tenancy** (orgs with shared docs) | 1 week | me | After P0/P1 — only when needed |
| 🟢 P3 | **Org admin dashboard** (manage members, billing, settings) | 1 day | me | After workspaces |
| 🟢 P3 | **Custom domains for users** (Business tier) | 2 days | me | After workspaces + Stripe |
| 🟢 P3 | **SAML SSO** via Firebase Identity Platform | 1 day | me | Enterprise customer asks for it |
| 🟢 P3 | **Legal hold** flag overriding deletes | 4 hrs | me | Enterprise customer asks for it |
| 🟢 P3 | **Migrate Firestore → Postgres** for relational queries | 1 week | me | At ~500K users (per spec) |
| 🟢 P3 | **Redis / Upstash** for link KV + rate limits + cache | 4 hrs | me | At ~10K users |
| 🟢 P3 | **BullMQ AI queue** | 4 hrs | me | When AI calls become slow |

### 🐛 Lane 9 — Tech debt / known issues

| Priority | Task | Effort | Owner | Blockers |
|---|---|---|---|---|
| 🟡 P1 | **Dashboard "Open dashboard" link** in landing page goes to `/dashboard` which redirects to anon-signin → could feel jarring on first visit. Add a "What you'll see" preview or signin gate. | 1 hr | me | None |
| 🟡 P1 | **Stale `kalanews` empty commit** on `vision-api-clean-minimal` branch (my earlier mistake) | leave as-is | None | Akhil said it's fine |
| 🟢 P2 | **Tests = zero** — every refactor is a lottery. Need ~20 unit tests for auth/rate-limit/moderation/takedown | 1 day | me | None |
| 🟢 P2 | **`disableLogger` Sentry deprecation warning** | 5 min | me | None |

---

## Suggested next 3 actions

If you only do 3 things from this board, do these:

1. **Buy custom domain + connect to Vercel** (Lane 1, 🔴 P0)
   - Single biggest unlock. Required for partner programs, GPT Store discoverability, and per-doc subdomain isolation.
2. **Update + publish your ChatGPT GPT to "Anyone with link"** (Lane 1, 🔴 P0)
   - Already eligible — Privacy URL is live. ~3 minutes.
3. **Build per-user ACL** (Lane 3 entire) — needs Resend signup
   - Closes the biggest "Google Docs equivalent" feature gap. ~6 hrs once Resend is set up.

After those three, re-evaluate against the [vision memory](../../../.claude/projects/-Users-akhilrkngmail-com/memory/sendoc_vision.md) readiness checklist.

---

## Decision log

- **2026-04-26**: Pivoted from CollabAI spec (Google-Docs-with-AI) → sendoc connector (publishing layer for ChatGPT/Claude). Reasoning: clearer differentiation, lower AI cost (users pay), easier distribution (GPT Store + MCP marketplace exist).
- **2026-04-26**: Chose **token-gated edit URLs** instead of identity-gated ACL for v1. Anonymous-publish UX matters more than per-user permissions when most flows go through ChatGPT/Claude where there's no sendoc identity.
- **2026-04-26**: HTML rendering uses sandboxed iframe (`sandbox="allow-popups"`, no scripts). Per-doc subdomain isolation deferred until custom domain.
- **2026-04-26**: Added **whole-doc AI editing** on `/edit/[editToken]`. The AI gets the full current doc + the user's instruction and outputs a complete updated doc; the user previews and applies. Chose this over selection-aware inline AI (Notion-style) because it's simpler, doesn't require Tiptap, and covers the most common use case ("add a section" / "make this concise" / "translate"). Inline AI stays in Lane 5 P3 for after Tiptap lands.

---

## Vision-readiness scorecard

Auto-pull from [memory](../../../.claude/projects/-Users-akhilrkngmail-com/memory/sendoc_vision.md). Last evaluated 2026-04-26:

```
Foundation     [████░░░░░░] 40%   missing: custom domain, lawyer review, real logo
Compliance     [████░░░░░░] 40%   missing: encrypt-at-rest, full audit, SOC2 prep
Distribution   [█░░░░░░░░░] 10%   missing: GPT Store publish, marketing, users
Application    [░░░░░░░░░░]  0%   blocked on traction
─────────────────────────────────────────────────────────────────────────
Overall:       ~22% to default-menu eligibility
```
