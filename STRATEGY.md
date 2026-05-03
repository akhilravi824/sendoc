# sendoc — Strategy

## The thing

**Sendoc is the canvas where AI agents and humans write together, live.**

One canvas. Every mind. One URL.

## What we will not be

- **Not** another "publish AI content as a link." That's a feature, not a company.
- **Not** Notion, Webflow, or Figma. Those are platforms; we are a primitive.
- **Not** a wrapper around Claude or ChatGPT. We are neutral, and that's the point.
- **Not** for everyone. We are for people who treat AI output as work, not chat.

## What we are

A live multiplayer document where you and your AI team collaborate in real time. Claude here. GPT-4 there. A teammate. A reviewer. Each one a cursor on the same doc, edits arriving as they type.

When the work is done, the doc has a URL. That URL has a clock. Owned docs live forever. Anonymous docs expire in seven days. Every change is in the log. Every link can be revoked.

## Why now

Three things just became true at once:

1. **AI output is work.** People send AI-generated proposals, briefs, posts, lesson plans. Real things, with real consequences. They need real artifacts.
2. **Multiplayer became table stakes.** Every modern doc tool — Google Docs, Notion, Figma, Linear — assumes multi-cursor. Nothing in AI does. We change that.
3. **The big platforms can't decide.** Anthropic and OpenAI both ship publishing, but theirs is single-player and branded. Their incentive is to keep you in their app. Ours is to make the work go anywhere.

## The product, in three lines

1. **Type in markdown. Or talk to AI. Or both at once.** The editor doesn't care who's writing.
2. **Add agents like you'd add teammates.** Each agent has a persona, a color, a cursor. They edit live.
3. **One URL. Edit it. Share it. Take it down.** The lifecycle layer the AI tools forgot.

## How we win

- **Multiplayer is real today.** Yjs + Hocuspocus shipping. Two browsers, one doc, live cursors.
- **Multi-agent next.** Same primitive — agents are just non-human peers in the Yjs room. Server-side calls Anthropic / OpenAI / etc., streams output as cursor edits. Already feasible with the architecture we built.
- **Connectors everywhere.** Native MCP for Claude. OpenAPI for ChatGPT. SDK for everyone else. We don't compete with the AI labs — we ship to wherever they ship.
- **Lifecycle by default.** TTL, claim, take-down, audit, encrypt-at-rest, soft-delete grace. The boring stuff that lawyers and agencies pay for.

## Why we will not lose

The big labs will copy "publish to link." They will not build live multi-agent multi-user collab as a side feature, because it is the whole product. Linear didn't lose to Asana. Figma didn't lose to PowerPoint. The opinionated thing wins when it's actually good.

## How we get to $1M ARR

Not by features. By focus on one shape of user, then expanding.

```
Free        sendoc.app subdomain · 5 docs/mo · 1 agent · 7-day TTL
Pro $19     custom domain · 200 docs/mo · 3 agents · password protect
Studio $49  team workspace · 10 agents · agent personas library · audit export
Enterprise  custom · SSO · retention policy · legal hold · DLP
```

To $1M:
- 1,000 Pro × $19/mo = $228K
- 1,000 Studio × $49/mo = $588K
- 50 Enterprise × $300/mo (modest) = $180K
- **Total: ~$996K ARR @ 2,050 customers**

The $49 tier is the engine. It's where small teams pay for AI agents on tap.

## The first niches

We don't pick a vertical first. We let the niches pick us by product feel. The four most likely:

1. **Marketing & content teams** — generating posts, briefs, copy. They have AI fatigue and want one place that holds it.
2. **Boutique consultants** — sending AI deliverables to clients. They need branding, takedown, retention.
3. **Course creators & teachers** — building lesson plans with AI. They need link-by-link control.
4. **Indie devs building AI apps** — they want a publish primitive (Path B / API). Free distribution into the developer ecosystem.

We build for all four because the product surface is the same. Niche pricing comes once we see who pays.

## What we ship next, in order

1. **Live multi-cursor collab on `/edit/[editToken]`.** Tiptap + Yjs + Hocuspocus. ✅ in the codebase, awaiting Fly.io deploy.
2. **The new landing page** that tells the story above, with a live animated demo of the canvas.
3. **`/demo`** — anyone can visit, see simulated AI agents collaborating with them. No signup.
4. **Custom domains** — Pro tier table stakes.
5. **Stripe + plans** — so people can pay.
6. **Multi-agent backend** — the real version of the demo. Server-side AI agents as Yjs peers.
7. **Agent personas library** — Writer, Editor, Researcher, Fact-checker, Designer.
8. **Studio team workspaces** — multi-seat, shared dashboard.

Roughly 12 weeks to all of it, solo, working evenings.

## What we don't ship

- Drag-and-drop canvas (Figma).
- Code execution sandbox (Replit).
- A general-purpose database / wiki (Notion).
- An app builder (v0, Bolt).
- Anything that isn't on the path to one canvas, every mind.

## The bet

**Multi-agent live collab is the next interface for AI work, and sendoc is the neutral surface where it happens.**

Everything else follows from that.
