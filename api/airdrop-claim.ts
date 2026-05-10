import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddressSync, getMint, getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token'
import { calculatePassportScore } from '../src/lib/scoring'

type ClaimBody = {
  solAddress?: string
  score?: number
  stamps?: string[]
  walletAgeDays?: number
}

const claimed = new Set<string>()

function envNum(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function parseSecretKey(secret: string): Uint8Array {
  const normalized = secret.trim().replace(/^'+|'+$/g, '')
  const arr = JSON.parse(normalized) as number[]
  return Uint8Array.from(arr)
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const body = await req.json() as ClaimBody
    const solAddress = body.solAddress?.trim()
    const score = Number(body.score ?? 0)
    const stamps = Array.isArray(body.stamps) ? body.stamps : []
    const walletAgeDays = Number(body.walletAgeDays ?? 0)

    if (!solAddress) return new Response(JSON.stringify({ error: 'Missing solAddress' }), { status: 400 })
    const recipient = new PublicKey(solAddress)
    const passportScore = calculatePassportScore(score, stamps)

    const minScore = envNum('HUMAN_MIN_SCORE', 5)
    const minWalletAgeDays = envNum('MIN_WALLET_AGE_DAYS', 1)
    if (!(passportScore > minScore)) {
      return new Response(JSON.stringify({ error: `Score must be > ${minScore}` }), { status: 400 })
    }
    if (walletAgeDays < minWalletAgeDays) {
      return new Response(JSON.stringify({ error: `Wallet age must be >= ${minWalletAgeDays} day` }), { status: 400 })
    }

    const campaignId = process.env.CAMPAIGN_ID ?? 'devnet-default'
    const claimKey = `${campaignId}:${recipient.toBase58()}`
    if (claimed.has(claimKey)) {
      return new Response(JSON.stringify({ error: 'This wallet already claimed for this campaign' }), { status: 409 })
    }

    const rpc = process.env.SOLANA_RPC_URL
    const mintAddress = process.env.AIRDROP_TOKEN_MINT
    const treasurySecret = process.env.CLAIM_TREASURY_SECRET
    const airdropAmount = envNum('AIRDROP_AMOUNT', 10)
    if (!rpc || !mintAddress || !treasurySecret) {
      return new Response(JSON.stringify({ error: 'Missing server env configuration' }), { status: 500 })
    }

    const connection = new Connection(rpc, 'confirmed')
    const treasury = Keypair.fromSecretKey(parseSecretKey(treasurySecret))
    const mint = new PublicKey(mintAddress)

    const mintInfo = await getMint(connection, mint)
    const decimals = mintInfo.decimals
    const baseUnits = BigInt(Math.floor(airdropAmount * 10 ** decimals))
    if (baseUnits <= 0n) {
      return new Response(JSON.stringify({ error: 'Airdrop amount resolves to zero base units' }), { status: 400 })
    }

    const sourceAta = getAssociatedTokenAddressSync(mint, treasury.publicKey)
    const destinationAta = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,
      mint,
      recipient,
    )

    const txHash = await transfer(
      connection,
      treasury,
      sourceAta,
      destinationAta.address,
      treasury.publicKey,
      baseUnits,
    )

    claimed.add(claimKey)
    return new Response(JSON.stringify({ ok: true, txHash }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}

