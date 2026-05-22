# PassportSOL

PassportSOL is a Solana reputation passport app.
It helps a wallet collect identity signals, mint a compact on-chain passport, verify that passport publicly, and optionally use it for campaign or airdrop gating.

## What the project does

PassportSOL combines several pieces into one flow:

- connect a Solana wallet
- optionally link an Ethereum identity
- collect stamps such as Gitcoin score, GitHub, ENS, SNS, SolanaID, wallet age, and activity
- mint the resulting passport to Solana through a memo transaction
- verify an address publicly on the `/verify` page
- check airdrop readiness and claim an SPL token through the backend API

In short: PassportSOL is a reputation and eligibility layer for Solana communities and campaigns.

## Main user flow

1. Connect a Solana wallet.
2. Fund the wallet with enough SOL for network fees.
3. Optionally link Ethereum identity data.
4. Collect reputation stamps.
5. Mint the passport on-chain.
6. Open the verify view or continue to the claim flow.

## Current product scope

The app currently includes:

- Solana wallet onboarding
- LI.FI-based funding entry point
- Gitcoin-based reputation input
- GitHub and name-service style stamps
- wallet age and transaction-history scoring
- on-chain passport minting and invalidation
- public verify page by Solana address
- serverless SPL airdrop claim route

## Tech stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- `@solana/web3.js`
- Solana Wallet Adapter
- Wagmi + SIWE for Ethereum identity linking
- LI.FI widget
- Vercel serverless API routes

## Running the project locally

### Requirements

- Node.js 18+
- npm
- a Solana wallet such as Phantom
- optional Ethereum wallet for the ETH identity step

### Install

```bash
npm install
```

### Configure environment

Copy `.env.example` to `.env` and fill in the values you need.

Important groups:

- frontend RPC and wallet settings
- Gitcoin scorer credentials
- GitHub OAuth client ID
- backend claim configuration

Important backend-only secrets:

- `CLAIM_TREASURY_SECRET`
- `SOLANA_RPC_URL`
- `SOLANA_WS_URL`

Never expose backend secrets as `VITE_*` variables.

### Start development

```bash
npm run dev
```

Open the app at `http://localhost:5173`.

### Production build

```bash
npm run build
npm run preview
```

## Environment overview

### Frontend variables

- `VITE_SOLANA_RPC_URL`
- `VITE_SOLANA_RPC_FALLBACK`
- `VITE_SOLANA_WS_URL`
- `VITE_GITCOIN_API_KEY`
- `VITE_GITCOIN_SCORER_ID`
- `VITE_GITHUB_CLIENT_ID`
- `VITE_HUMAN_MIN_SCORE`
- `VITE_MIN_WALLET_AGE_DAYS`
- `VITE_MIN_SOL_FOR_CLAIM`

### Backend variables

- `SOLANA_RPC_URL`
- `SOLANA_WS_URL`
- `AIRDROP_TOKEN_MINT`
- `AIRDROP_AMOUNT`
- `CLAIM_TREASURY_SECRET`
- `CAMPAIGN_ID`
- `HUMAN_MIN_SCORE`
- `MIN_WALLET_AGE_DAYS`

## API routes

- `POST /api/github-device-code`
- `POST /api/github-token`
- `POST /api/twitter-token`
- `POST /api/airdrop-claim`

## Project structure

```text
api/                     Vercel serverless functions
docs/                    project notes, handoff docs, pitch assets, brand assets
public/                  static files
src/components/          app UI and flow steps
src/lib/                 Solana, Gitcoin, LI.FI, scoring, and utility logic
src/config/              campaign-level public thresholds
```

## Important docs

- [docs/PASSPORTSOL_HANDOFF.md](docs/PASSPORTSOL_HANDOFF.md)
- [docs/DEVNET_AIRDROP_SETUP.md](docs/DEVNET_AIRDROP_SETUP.md)
- [docs/LIFI_SIDETRACK_PLAN.md](docs/LIFI_SIDETRACK_PLAN.md)
- [docs/pitch/README.md](docs/pitch/README.md)
- [docs/brand/README.md](docs/brand/README.md)

## Known limitations

- duplicate-claim protection is still in-memory and not persistent
- mobile flow is intentionally conservative while wallet return UX is stabilized
- the claim route currently depends on server-side SPL token configuration
- LI.FI and campaign gating logic should be treated as evolving MVP behavior

## Deploying

This repo is structured for Vercel:

1. import the repo into Vercel
2. add the same environment variables from `.env`
3. verify wallet callbacks and API settings
4. deploy the frontend and `api/` routes together

## Collateral and brand assets

Project collateral no longer needs to live in the repo root.

- pitch decks and slide exports belong in `docs/pitch/`
- logos and social images belong in `docs/brand/`

If you add more presentation material later, keep it in those folders instead of the root directory.
