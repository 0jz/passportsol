# Devnet Airdrop Setup (Chainstack + SPL)

## Already configured
- `VITE_SOLANA_RPC_URL` (Chainstack HTTPS)
- `VITE_SOLANA_WS_URL` (Chainstack WSS)

## Values you still need
1. `AIRDROP_TOKEN_MINT`
2. `AIRDROP_AMOUNT`
3. `CLAIM_TREASURY_SECRET` (server-only)

## How to get them

### 1) Create a devnet treasury wallet
```bash
solana-keygen new -o ./treasury-devnet.json
solana config set --url devnet
solana airdrop 2 $(solana-keygen pubkey ./treasury-devnet.json)
```

### 2) Create SPL token mint on devnet
```bash
spl-token create-token --owner ./treasury-devnet.json
```
- Output includes token mint address -> set as `AIRDROP_TOKEN_MINT`.

### 3) Create treasury token account + mint supply
```bash
spl-token create-account <AIRDROP_TOKEN_MINT> --owner ./treasury-devnet.json
spl-token mint <AIRDROP_TOKEN_MINT> 1000000 --owner ./treasury-devnet.json
```

### 4) Export treasury secret for backend
- Read JSON from `treasury-devnet.json` and set as `CLAIM_TREASURY_SECRET` in server env only.
- Never expose this in frontend env (`VITE_*`).

## Recommended env split
- Frontend:
  - `VITE_SOLANA_RPC_URL`
  - `VITE_SOLANA_RPC_FALLBACK`
  - `VITE_SOLANA_WS_URL`
- Backend/API only:
  - `SOLANA_RPC_URL`
  - `SOLANA_WS_URL`
  - `AIRDROP_TOKEN_MINT`
  - `AIRDROP_AMOUNT`
  - `CLAIM_TREASURY_SECRET`

## Next implementation step
- Add `/api/airdrop-claim` route that:
  1. validates eligibility,
  2. prevents duplicate claims,
  3. sends SPL transfer,
  4. returns tx hash.

