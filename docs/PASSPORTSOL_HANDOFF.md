# PassportSOL Handoff

Date: 2026-05-10  
Project: PassportSOL (`passportsol-vite`)  
Repo: `https://github.com/0jz/passportsol`

## 1) Project Overview

PassportSOL is a Solana reputation passport app:
- User links ETH identity (optional) and fetches Gitcoin Passport score.
- User adds stamps (GitHub, ENS/SNS/SolanaID, event stamps, Solana wallet activity).
- App mints/updates passport data on Solana (memo-based record).
- Verify page reads passport from chain by Solana address.
- Added LI.FI-oriented flow for funding + claim readiness.
- Added SPL token airdrop claim backend (devnet).

## 2) What We Implemented

### A) Core flow reviewed and stabilized
- Full codebase walkthrough and architecture mapping.
- Mobile Phantom flow fixes and fallback behavior updates.

### B) Luma removal
- Removed Luma QR/iCal/manual Luma entrypoints from stamp flow.
- Removed unused Luma routes/helpers.

### C) RPC hardening
- Added fallback/retry handling in Solana utility layer.
- Configurable primary/fallback RPC endpoints.

### D) Mobile temporary fallback
- Added mobile “coming soon” gate (Android/iOS) to avoid unstable mobile tx UX in production.

### E) Airdrop eligibility logic
- Added eligibility rules:
  - `score > 5`
  - `walletAgeDays >= 1`
- Added wallet age computation from on-chain history.
- Added eligibility display to passport UI.

### F) LI.FI sidetrack-oriented UX
- Added LI.FI funding rail panel in post-passport flow.
- Added funding CTA via Jumper URL generator.
- Added readiness UX (eligibility + balance + claim path).

### G) SPL claim backend
- Added `/api/airdrop-claim` route.
- Route does:
  - validation checks (score, wallet age),
  - transfer SPL token from treasury ATA to recipient ATA,
  - returns claim tx hash.
- Switched runtime handling to reduce function crash risk.
- Fixed NodeNext import extension issue in API route.

### H) SOL address visibility
- Passport UI now shows SOL address in main identity block.

## 3) Current Config Values (Known)

From the session, these values were set/provided:
- `AIRDROP_TOKEN_MINT=AZG134Bqyy6giqMznoxz5iNhScuQFae6oLcwo2LWqLKX`
- `TREASURY_WALLET_ADDRESS=7f7Gqo2rCMXSRdeqR7spLkx8vS9U6YLH1KH6xTVBrmEL`
- `AIRDROP_AMOUNT=10`
- `SOLANA_RPC_URL=https://solana-devnet.core.chainstack.com/e45c6bc188be806dd2c56981a1626fff`
- `SOLANA_WS_URL=wss://solana-devnet.core.chainstack.com/e45c6bc188be806dd2c56981a1626fff`

Important:
- `CLAIM_TREASURY_SECRET` was shared during session and is compromised.
- Must rotate treasury key immediately for safe use.

## 4) Security Notes

### Critical
- Treasury private key was exposed in chat context.
- Actions required:
  1. Generate new treasury keypair.
  2. Move remaining funds/tokens to new treasury.
  3. Replace `CLAIM_TREASURY_SECRET` in all environments.
  4. Never store private keys in `VITE_*` vars or repo files.

### CSP warning note
- CSP `unsafe-eval` warning likely from extension/runtime context.
- Do not add `unsafe-eval` unless absolutely necessary.

## 5) Known Limitations

1. Duplicate claim protection is currently in-memory (`Set`) in API function.
   - Not persistent across cold starts/redeploys.
2. Token appears as “Unknown token” in wallets without metadata/registry entries.
3. Mobile flow intentionally gated as “coming soon”.
4. LI.FI integration is funding CTA-driven (Jumper URL), not full SDK route execution yet.

## 6) TODO (Priority Order)

## P0 - Safety and Reliability
- [ ] Rotate treasury keys and env secrets.
- [ ] Replace in-memory duplicate claim protection with persistent store (Redis/DB).
- [ ] Add robust server logging for claim route (structured errors + correlation ID).

## P1 - Product Completeness (MVP)
- [ ] Add campaign config as server source of truth (score/age/amount/mint/campaign window).
- [ ] Add explicit campaign window checks (`start/end`) in claim API.
- [ ] Add claim history endpoint for UI/admin visibility.
- [ ] Add clearer claim statuses in UI (`idle/claiming/claimed/error`) with retry hints.

## P2 - LI.FI Track Depth
- [ ] Integrate LI.FI Widget/SDK route quote in-app (not link-only).
- [ ] Show route details (expected output, fees, ETA).
- [ ] Mark funding step complete after balance refresh.
- [ ] Add event tracking funnel:
  - open_funding
  - funding_completed
  - claim_attempted
  - claim_succeeded

## P3 - Token UX
- [ ] Add token metadata (name/symbol/logo) so wallet no longer shows unknown token.
- [ ] Add in-app token balance display post-claim.

## P4 - Mobile
- [ ] Re-enable mobile after reliable wallet transaction return flow is validated.
- [ ] Keep explicit fallback for wallet/browser mismatch edge cases.

## 7) Suggested Environment Variables

### Frontend
- `VITE_SOLANA_RPC_URL`
- `VITE_SOLANA_RPC_FALLBACK`
- `VITE_SOLANA_WS_URL`
- `VITE_HUMAN_MIN_SCORE`
- `VITE_MIN_WALLET_AGE_DAYS`
- `VITE_MIN_SOL_FOR_CLAIM`

### Backend only
- `SOLANA_RPC_URL`
- `SOLANA_WS_URL`
- `AIRDROP_TOKEN_MINT`
- `AIRDROP_AMOUNT`
- `CLAIM_TREASURY_SECRET`
- `HUMAN_MIN_SCORE`
- `MIN_WALLET_AGE_DAYS`
- `CAMPAIGN_ID`

## 8) Deploy/Debug Checklist

1. Confirm all backend env vars are set in Vercel Production and Preview.
2. Trigger redeploy after env changes.
3. Test claim with an eligible wallet.
4. Validate:
   - claim tx hash returned
   - recipient token balance increases
   - duplicate claim blocked persistently.

## 9) Commands Reference

### Check Solana CLI config
```bash
solana config get
```

### Create SPL token (devnet)
```bash
spl-token create-token
spl-token create-account <TOKEN_MINT>
spl-token mint <TOKEN_MINT> 1000000
```

### Wallet address from keypair
```bash
solana-keygen pubkey <KEYPAIR_FILE>
```

## 10) Current Branch/History Notes

Recent major work was merged into `main` and pushed.  
If continuing implementation, create a new feature branch from latest `main` and keep this file updated as single source of handoff truth.

