# PassportSOL Handoff

Datum: 2026-05-10  
Projekat: PassportSOL (`passportsol-vite`)  
Repo: `https://github.com/0jz/passportsol`

## 1) Pregled projekta

PassportSOL je aplikacija za reputacioni pasoš na Solani:
- Korisnik povezuje ETH identitet (opciono) i učitava Gitcoin Passport score.
- Korisnik dodaje stampove (GitHub, ENS/SNS/SolanaID, event stampovi, aktivnost Solana novčanika).
- Aplikacija mintuje/azurira passport podatke na Solani (memo-based zapis).
- Verify strana čita passport sa chain-a po Solana adresi.
- Dodat je LI.FI tok za funding + claim readiness.
- Dodat je SPL token airdrop claim backend (devnet).

## 2) Šta je implementirano

### A) Pregled i stabilizacija osnovnog toka
- Prođen ceo kod i mapirana arhitektura.
- Urađeni popravci mobilnog Phantom toka i fallback ponašanja.

### B) Uklonjen Luma deo
- Uklonjeni Luma QR/iCal/manual Luma entrypoint-i iz stamp toka.
- Uklonjeni neiskorišćeni Luma API helper-i/rute.

### C) RPC hardening
- Dodat fallback/retry handling u Solana utility sloju.
- Konfigurisiv primarni/fallback RPC endpoint.

### D) Privremeni mobile fallback
- Dodat “coming soon” ekran za mobile (Android/iOS) dok se ne stabilizuje mobile tx UX.

### E) Pravila za eligibility
- Dodata pravila:
  - `score > 5`
  - `walletAgeDays >= 1`
- Dodat obračun starosti novčanika iz on-chain istorije.
- Eligibility prikazan u Passport UI.

### F) LI.FI sidetrack UX
- Dodat LI.FI funding panel u post-passport toku.
- Dodat funding CTA preko Jumper URL generatora.
- Dodat readiness UX (eligibility + balance + claim putanja).

### G) SPL claim backend
- Dodata ruta `/api/airdrop-claim`.
- Ruta radi:
  - proveru uslova (score, starost novčanika),
  - anti-dupli-claim (u trenutnoj instanci),
  - SPL transfer sa treasury ATA na korisnika,
  - vraća claim tx hash.
- Runtime prilagođen da se smanji rizik od function crash-a.
- Ispravljen NodeNext import ekstenzije u API ruti.

### H) SOL adresa u pasošu
- Passport UI sada prikazuje i SOL adresu u glavnom identity bloku.

## 3) Trenutne konfiguracione vrednosti

Vrednosti korišćene tokom sesije:
- `AIRDROP_TOKEN_MINT=AZG134Bqyy6giqMznoxz5iNhScuQFae6oLcwo2LWqLKX`
- `TREASURY_WALLET_ADDRESS=7f7Gqo2rCMXSRdeqR7spLkx8vS9U6YLH1KH6xTVBrmEL`
- `AIRDROP_AMOUNT=10`
- `SOLANA_RPC_URL=https://solana-devnet.core.chainstack.com/e45c6bc188be806dd2c56981a1626fff`
- `SOLANA_WS_URL=wss://solana-devnet.core.chainstack.com/e45c6bc188be806dd2c56981a1626fff`

## 4) Napomene o bezbednosti

### Kritično
- `CLAIM_TREASURY_SECRET` treba čuvati isključivo kao server-side secret.
- Nikada ne ide u `VITE_*` env niti u repo fajlove.

### CSP napomena
- CSP `unsafe-eval` warning je najverovatnije iz extension/runtime konteksta.
- Ne dodavati `unsafe-eval` osim ako je apsolutno neophodno.

## 5) Poznata ograničenja

1. Zaštita od duplog claim-a je trenutno in-memory (`Set`) u API funkciji.
   - Nije trajna kroz cold start/redeploy.
2. Token se može prikazivati kao “Unknown token” bez metadata/registry mapiranja.
3. Mobile flow je namerno zaključan kao “coming soon”.
4. LI.FI integracija je trenutno funding CTA (Jumper URL), ne full SDK route execution.

## 6) TODO (prioriteti)

## P0 - Bezbednost i pouzdanost
- [ ] Prebaciti anti-dupli-claim sa in-memory na perzistentni store (Redis/DB).
- [ ] Dodati detaljniji server logging za claim rutu (structured errors + correlation ID).

## P1 - MVP kompletiranje
- [ ] Uvesti server source-of-truth campaign config (score/age/amount/mint/time window).
- [ ] Dodati campaign window proveru (`start/end`) u claim API.
- [ ] Dodati claim history endpoint za UI/admin pregled.
- [ ] Doraditi claim statuse u UI (`idle/claiming/claimed/error`) sa jasnim retry porukama.

## P2 - LI.FI track dubina
- [ ] Integrisati LI.FI Widget/SDK quote direktno u app (ne samo link).
- [ ] Prikaz route detalja (expected output, fee, ETA).
- [ ] Jasno obeležiti funding step kao completed posle balance refresh-a.
- [ ] Dodati funnel događaje:
  - open_funding
  - funding_completed
  - claim_attempted
  - claim_succeeded

## P3 - Token UX
- [ ] Dodati token metadata (name/symbol/logo) da wallet ne prikazuje unknown token.
- [ ] Dodati in-app prikaz token balansa posle claim-a.

## P4 - Mobile
- [ ] Ponovo uključiti mobile kada wallet tx return flow postane stabilan.
- [ ] Zadržati jasan fallback za wallet/browser mismatch edge case.

## 7) Predlog env promenljivih

### Frontend
- `VITE_SOLANA_RPC_URL`
- `VITE_SOLANA_RPC_FALLBACK`
- `VITE_SOLANA_WS_URL`
- `VITE_HUMAN_MIN_SCORE`
- `VITE_MIN_WALLET_AGE_DAYS`
- `VITE_MIN_SOL_FOR_CLAIM`

### Backend (server-only)
- `SOLANA_RPC_URL`
- `SOLANA_WS_URL`
- `AIRDROP_TOKEN_MINT`
- `AIRDROP_AMOUNT`
- `CLAIM_TREASURY_SECRET`
- `HUMAN_MIN_SCORE`
- `MIN_WALLET_AGE_DAYS`
- `CAMPAIGN_ID`

## 8) Deploy/Debug checklist

1. Proveriti da su svi backend env-ovi setovani na Vercel (Production i Preview).
2. Trigger redeploy nakon env izmena.
3. Testirati claim sa eligible wallet-om.
4. Validirati:
   - vraćen claim tx hash,
   - rast token balansa kod primaoca,
   - trajnu blokadu duplog claim-a.

## 9) Komande

### Provera Solana CLI konfiguracije
```bash
solana config get
```

### Kreiranje SPL tokena (devnet)
```bash
spl-token create-token
spl-token create-account <TOKEN_MINT>
spl-token mint <TOKEN_MINT> 1000000
```

### Wallet adresa iz keypair fajla
```bash
solana-keygen pubkey <KEYPAIR_FILE>
```

## 10) Branch/history napomena

Većina ključnih izmena je mergeovana i pushovana na `main`.  
Za sledeće izmene preporuka je novi feature branch sa ovog stanja i ažuriranje ovog fajla kao glavnog handoff izvora.
