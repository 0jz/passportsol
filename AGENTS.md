# AGENTS.md — PassportSOL

Solana reputation passport (React + Vite SPA) with Vercel serverless routes for GitHub OAuth proxying and an SPL airdrop claim.

## Commands
- Install: `npm install` (Node 20, see `.nvmrc`)
- Dev (frontend only): `npm run dev` → http://localhost:5173
- API routes locally: `vercel dev` (Vercel CLI; not a project dependency)
- Build + type-check: `npm run build` (`tsc -b && vite build`)
- Lint: `npm run lint`
- Tests: none exist.

## Where logic lives
- `src/App.tsx` — whole user flow, `mint`/`verify` tabs (state, not URL routes), claim call.
- `src/lib/scoring.ts` — stamp regex → bonus points; shared by UI and `api/airdrop-claim.ts`. Change both behaviours together.
- `src/lib/solana.ts` — Memo-program passport mint/invalidate, RPC fallback.
- `src/config/campaign.ts` — public thresholds (`VITE_*`); must mirror server env (`HUMAN_MIN_SCORE`, `MIN_WALLET_AGE_DAYS`).
- `api/airdrop-claim.ts` — Node function; eligibility, in-memory dedupe, SPL transfer, LI.FI check (mainnet only).
- `api/github-*.ts` — edge-runtime proxies to GitHub device flow.
- `src/lib/phantom-deeplink.ts` + `public/relay.html` — mobile Phantom deep-link flow.

## Conventions
- TypeScript, function components + hooks, Tailwind v4 via `@tailwindcss/vite`.
- Network switch is `VITE_SOLANA_NETWORK === 'mainnet'`; everything else is devnet.
- Server code imports shared code with `.js` extensions (`../src/lib/scoring.js`).

## Do not touch / commit
- `.env*` (gitignored). Never move server secrets (`CLAIM_TREASURY_SECRET`) into `VITE_*`.
- Treasury keypair files such as `treasury-devnet.json` (from `docs/DEVNET_AIRDROP_SETUP.md`) are **not** in `.gitignore` — never commit them.
- `docs/pitch/` (.pptx decks, slide JPGs) and `docs/brand/` (logos, banners) are collateral; keep new collateral there, not in the repo root.

## Gotchas
- `.env.example` lists `VITE_SOLANA_WS_URL`, `SOLANA_WS_URL`, `GITHUB_CLIENT_ID`; code doesn't read them.
- `api/twitter-token.ts` is unused by the UI.
- Claim API trusts client-sent score/stamps; dedupe resets on cold start.

Humans: see README.md
