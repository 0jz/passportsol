# PassportSOL Master Context

Datum poslednjeg ažuriranja: 2026-05-11  
Repo: `https://github.com/0jz/passportsol`  
Lokalni projekat: `C:\Users\Vesna\WebstormProjects\passportsol-vite`

Ovaj fajl je zamišljen kao glavni referentni dokument za PassportSOL. Služi kao sažetak proizvoda, tehničkog toka, pitching pravca, odluka koje su donete tokom rada i materijala iz stare i novih prezentacija.

## 1. Šta je PassportSOL

PassportSOL je loyalty i reputation layer za Solanu.

U najjednostavnijem obliku:
- korisnik skuplja bedževe i signale reputacije,
- od tih signala gradi jedan pasoš,
- projekti taj pasoš koriste da bolje prepoznaju stvarne članove zajednice,
- korisnik otključava airdropove, access i nagrade.

Osnovna ideja se razvijala iz anti-sybil ugla, ali se pozicioniranje vremenom pomerilo ka kolekcionarskom i loyalty iskustvu:
- ranije: "zaštita od botova"
- sada: "collectible loyalty passport for Solana communities"

## 2. Kratka verzija proizvoda

PassportSOL korisniku daje osećaj da skuplja reputaciju, a projektima daje jednostavan signal poverenja.

Glavne komponente:
- passport profil na Solani
- stampovi / bedževi
- eligibility pravila
- funding / onboarding tok ka Solani
- claim ili reward unlock tok

## 3. Osnovni user flow

Tipičan tok izgleda ovako:
1. korisnik povezuje Solana wallet
2. opciono povezuje ETH identitet
3. dodaje stampove i bedževe
4. mintuje ili update-uje passport
5. proverava eligibility
6. ako je potrebno, dopunjava wallet
7. claimuje token ili otključava reward

Raniji pitch je LI.FI bridge stavljao kao obavezni ulaz u sistem. Kasnije je UX ublažen tako da funding ostane važan onboarding korak, ali ne i jedini validan put do claim-a.

## 4. Šta je implementirano / šta smo prošli

Tokom rada na projektu obrađene su sledeće oblasti:

### A. Osnovna arhitektura i core flow
- pregledan je ceo tok mintovanja, verify strane, stampova, API ruta i wallet UX-a
- stabilizovan je deo osnovnog Solana passport iskustva

### B. Mobile / Phantom tok
- popravljan je Phantom mobile signing flow
- dodat je fallback pristup za slučajeve kada browser i wallet nisu u istom kontekstu
- u jednom trenutku je dodat i privremeni "coming soon" fallback za mobile dok se UX ne stabilizuje

### C. Stamps tok
- uklonjeni su Luma QR / iCal / manual Luma entrypoint-i iz stamp flow-a
- zadržani su korisniji i čistiji entrypoint-i za event attestations

### D. RPC i stabilnost
- dodat je RPC fallback / hardening sloj
- primarni i rezervni RPC mogu da se konfigurišu

### E. Eligibility pravila
- uveden je minimum za human score
- uveden je minimum za starost wallet-a
- UI prikazuje da li korisnik prolazi uslove i zašto

### F. Funding / bridge UX
- dodat je LI.FI funding panel
- funding je povezan sa post-passport tokom
- u različitim iteracijama testiran je stroži i blaži gating model

### G. Claim backend
- dodata je `/api/airdrop-claim` ruta
- backend proverava eligibility i radi SPL transfer
- dodat je anti-dupli-claim guard, ali je trenutno ograničen jer nije perzistentan

### H. Pitch i positioning
- projekat je prepakovan iz čisto anti-sybil proizvoda u collectible loyalty narrative
- nastalo je više novih pitch deck varijanti

## 5. Tehnički i proizvodni zaključci

Najvažniji zaključci iz dosadašnjeg rada:

- Sam "human score" nije dovoljan kao proizvodna priča. Mnogo je jače kada se priča kao kolekcija bedževa i loyalty pasoš.
- Sybil odbrana i dalje ostaje važna, ali treba da bude "infrastructure benefit", ne headline.
- Funding UX je važan zato što deo korisnika nema native SOL i bez toga ne može da završi akciju.
- UI i backend moraju da budu usklađeni. Ako UI kaže da je korisnik spreman za claim, dugme i backend moraju pratiti istu logiku.
- Za produkciju će biti neophodan persistent claim protection, a ne in-memory pristup.

## 6. Bitne claim / LI.FI lekcije

Ovo je važan deo koji vredi sačuvati za kasnije jer je pravio realne probleme u UX-u.

### Šta se desilo
- backend je u jednom trenutku vraćao `403` kada wallet nije imao odgovarajući LI.FI bridge signal
- UI je umeo da deluje kao da je korisnik spreman za claim iako backend to neće dozvoliti
- strogo LI.FI uslovljavanje je dovelo do zbunjujućeg iskustva gde je korisniku traženo da bridžuje iako je već funding odradio drugim putem

### Šta je naučeno
- funding readiness i claim eligibility nisu isto
- backend kriterijumi ne smeju da budu skriveni iza "green" UI poruka
- korisnik ne sme da bude teran na bridge samo zato što sistem ne ume da objasni šta mu još fali

### Trenutni praktični smer
- funding treba da postoji kao lak onboarding korak
- claim ne treba zaključavati samo zato što funding nije prošao kroz jedan specifičan integrator signal
- status poruke, enabled stanje dugmeta i backend odgovor moraju govoriti istu stvar

## 7. Poznata ograničenja i otvorene stavke

- anti-dupli-claim zaštita nije dovoljno jaka dok god je in-memory
- token može da se prikaže kao unknown bez metadata UX sloja
- mobile tok je osetljiv i traži dodatno poliranje
- LI.FI trenutno više služi kao funding rail / CTA nego kao duboko integrisan widget + route execution engine u finalnom smislu
- postoje i nepovezane lokalne izmene u repo-u koje nisu deo ovog dokumenta

## 8. Trenutni poznati env i campaign parametri

Vrednosti koje su bile aktivne tokom jedne od sesija:

- `AIRDROP_TOKEN_MINT=AZG134Bqyy6giqMznoxz5iNhScuQFae6oLcwo2LWqLKX`
- `TREASURY_WALLET_ADDRESS=7f7Gqo2rCMXSRdeqR7spLkx8vS9U6YLH1KH6xTVBrmEL`
- `AIRDROP_AMOUNT=10`
- `SOLANA_RPC_URL=https://solana-devnet.core.chainstack.com/e45c6bc188be806dd2c56981a1626fff`
- `SOLANA_WS_URL=wss://solana-devnet.core.chainstack.com/e45c6bc188be806dd2c56981a1626fff`

Važna napomena:
- `CLAIM_TREASURY_SECRET` mora ostati striktno server-side secret

## 9. Pitch positioning evolucija

Pozicioniranje je prošlo kroz nekoliko faza.

### Faza 1: anti-sybil i airdrop odbrana
Fokus:
- botovi odnose airdropove
- projekti ne znaju ko je stvaran korisnik
- PassportSOL uvodi dokaz reputacije

Prednost:
- jasan problem

Mana:
- zvuči više kao filter ili compliance alat nego kao proizvod koji korisnici žele

### Faza 2: cross-chain onboarding + funding + claim
Fokus:
- korisnik dolazi sa drugih chain-ova
- treba mu funding rail do Solane
- PassportSOL vodi od bridge-a do claim-a

Prednost:
- praktičniji proizvodni tok

Mana:
- previše tehnički za kraći pitch

### Faza 3: collectible loyalty passport
Fokus:
- korisnik skuplja bedževe
- reputacija postaje nešto vidljivo i kolekcionarski vredno
- projekti koriste taj pasoš da nagrade realno učešće

Prednost:
- lakše pamtljivo
- više consumer / community energije
- sybil defense ostaje u pozadini kao benefit

Ovo je trenutno najjači pitch smer.

## 10. Novi one-liner pravac

Najbolji novi one-liner koji je proizašao iz rada:

`PassportSOL je loyalty pasoš za Solanu: skupljaš bedževe, gradiš reputaciju i otključavaš nagrade koje botovi ne mogu da iskopiraju.`

Kraće alternative:

- `Collect badges. Build reputation. Unlock rewards.`
- `The collectible reputation layer for Solana communities.`
- `The more you collect, the more you unlock.`

## 11. Stara prezentacija: glavni sadržaj

Ovaj deo čuva suštinu originalnog deck-a `PassportSOL_Pitch.pptx`.

### Slide 1
Naslov i osnovni positioning:
- PassportSOL
- "Collect badges. Build your on-chain identity. Earn airdrops."
- Solana Blockchain
- Gitcoin Passport
- LI.FI Bridge
- Colosseum Hackathon 2025

### Slide 2 - Problem
Glavne poruke:
- `$94.5M` je otišlo sybil botovima u jednom airdrop primeru
- botovi uzimaju sve, pravi fanovi ostaju bez nagrade
- projekti ne mogu lako da razlikuju stvarnog korisnika od bot farme
- cross-chain korisnici ostaju zaključani ako nemaju Solana wallet

### Slide 3 - Kako radi
Originalni flow:
1. bridge in
2. collect badges
3. mint your passport
4. claim rewards

Poruka:
- iskustvo je predstavljeno kao loyalty card, ali on-chain

### Slide 4 - Badge collection
Glavni primeri bedževa:
- Solana OG
- Event Attendee
- GitHub Dev
- `.sol` Domain
- ENS holder

Centralna poruka:
- više bedževa = viši score = veći airdrop
- botovi ne mogu lako da sakupe bedževe

### Slide 5 - Passport
Poruke:
- jedan card za sve bedževe
- free to mint
- shareable
- portable
- više bedževa vodi do većih nagrada

### Slide 6 - LI.FI kao entry ticket
Originalni framing:
- "No bridge. No badges. No airdrop."
- bridge je bio predstavljen kao obavezni ulaz
- LI.FI je viđen kao način da bilo koji token i bilo koji chain dovedu korisnika do SOL-a

Važno za kasnije:
- ovo je jaka pitch poruka, ali je u praksi previše rigidna ako se bukvalno sprovede kao hard claim gate

### Slide 7 - LI.FI widget in context
Poruke:
- destination je korisnikov Solana wallet
- source može biti bilo koji chain / token
- route auto-select radi LI.FI
- claim se otključava kada funding prođe

### Slide 8 - Business model
Originalni model:
- projekti plaćaju, korisnici nikad
- verification API je glavni revenue
- starter: `$49/mo`
- pay-as-you-go: `$0.05/call`
- enterprise: custom
- dodatni upside kroz LI.FI affiliate revenue

Ko kupuje API:
- memecoin launcheri
- NFT projekti
- DAOs
- DeFi protokoli
- game studiji

### Slide 9 - Close
Glavne završne poruke:
- "The more you collect, the more you earn. Bots collect nothing."
- korisnici koriste proizvod besplatno
- projekti plaćaju API

## 12. Novi pitch pravac za kasnije prezentacije

Za naredne deck-ove i govorne nastupe preporuka je sledeća:

- manje tehnički pričati o bridge-u, API-ju i eligibility engine-u
- više isticati kolekciju, lojalnost, status i community belonging
- sybil defense držati kao dokaz da sistem radi, ne kao prvu emociju u priči
- "free for users" i "projects pay" ostaju vrlo jake i lake za pamćenje poruke

Najkorisniji pitch okvir za 2 minuta:
- problem: airdropovi danas nagrađuju brzinu i botove
- rešenje: PassportSOL pretvara participaciju u kolekcionarski pasoš
- mehanika: bedževi, pasoš, nagrade
- vrednost za projekte: bolji quality users i manje sybil leakage
- monetizacija: fiksna cena za manje timove, pay-as-you-go za veće

## 13. Nove prezentacije napravljene tokom rada

Tokom rada napravljene su sledeće novije prezentacije:

- `PassportSOL_Pitch_Collector_v2.pptx`
- `PassportSOL_Pitch_Graphics_Short_v3.pptx`
- `PassportSOL_Pitch_Graphics_Short_v4_team.pptx`

Prateći generator skriptovi:
- `scripts/generate_collector_pitch.py`
- `scripts/generate_graphic_short_pitch.py`

Razlika u odnosu na staru prezentaciju:
- manje generičnog hackathon tona
- više grafičkog prostora
- više prostora za app screenshotove
- kraći copy
- jači kolekcionarski i premium ton

## 14. Pricing koji treba koristiti nadalje

Najčistija pricing poruka za dalje:

- `Starter`: fiksno `$49 / month`
- `Larger projects`: `Pay as you go`
- korisnici: `free`

Ako treba detaljnije:
- manjim launch-evima je dovoljno da razumeju jednu fiksnu cenu
- veći projekti treba da vide da mogu da skaliraju po upotrebi

## 15. Kome proizvod najviše ima smisla

Najlogičniji ICP pravci:

- memecoin launch timovi
- community i growth timovi
- NFT zajednice
- DAOs
- rani Solana protokoli
- projekti koji žele whitelist / reward gating bez teškog KYC-ja

## 16. Materijal koji možeš kasnije da recikliraš

Iz ovog projekta možeš kasnije direktno da koristiš:

### Za pitch / grant / landing page
- problem statement o sybil botovima
- collectible loyalty framing
- one-linere iz sekcije 10
- pricing iz sekcije 14
- stari slide-by-slide kostur iz sekcije 11

### Za onboarding novih saradnika
- user flow iz sekcije 3
- implementirano iz sekcije 4
- claim / LI.FI lekcije iz sekcije 6
- ograničenja iz sekcije 7

### Za product roadmap
- persistent anti-dupli-claim
- bolji mobile UX
- token metadata UX
- dublja funding integracija
- analytics oko funding -> claim konverzije

## 17. Korisni prateći fajlovi u repo-u

Ako kasnije želiš da nastaviš odavde, najkorisniji postojeći fajlovi su:

- `docs/PASSPORTSOL_HANDOFF.md`
- `docs/SESSION_CONTEXT.md`
- `docs/PITCH_DECK_SR.md`
- `PassportSOL_Pitch_Script.md`
- `PassportSOL_Pitch.pptx`

Ovaj fajl treba da ostane glavni "single source of context", a ostali fajlovi mogu da služe kao detaljniji prilozi.
