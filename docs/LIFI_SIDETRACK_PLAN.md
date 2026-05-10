# LI.FI Sidetrack Fit (PassportSol)

## 1) Real World Usefulness
- Problem: Cross-chain users can have high trust/reputation on one ecosystem but no credible presence on Solana.
- PassportSol solution: Import reputation signals and gate memecoin airdrop eligibility by quality signals (`score > 5`, wallet age >= 1 day), reducing sybil spam.

## 2) Product Quality
- Existing core flow: connect wallet, mint passport, verify passport on-chain.
- Added quality controls:
  - explicit eligibility rules in code (`src/lib/airdropEligibility.ts`)
  - wallet age computed from chain history (`src/lib/solanaStats.ts`)
  - eligibility displayed in Passport UI (`src/components/PassportView.tsx`)

## 3) Depth of LI.FI Integration
- LI.FI is part of the main claim path, not an add-on:
  - `LI.FI Airdrop Rail` panel appears in post-mint flow.
  - If wallet lacks SOL for execution, user is routed to LI.FI-powered Jumper funding path (`src/lib/lifi.ts`).
  - Funding + eligibility together define claim readiness.

## 4) UX for Cross-Chain
- Single panel UX:
  - Eligibility status
  - Wallet age and SOL balance
  - Direct cross-chain funding CTA
  - Claim button state tied to readiness
- Reduces confusion by turning multi-step bridge+claim into one guided module.

## 5) Post Hackathon Potential
- Clear monetization and growth vectors:
  - partner campaigns (airdrop/gating as a service)
  - b2b community trust API
  - LI.FI flow analytics and conversion optimization
- Extendable to:
  - multi-campaign eligibility policies
  - automated claim distribution backend
  - cNFT credentials for portable partner integrations

